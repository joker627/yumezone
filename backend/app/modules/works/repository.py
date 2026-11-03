from typing import Any, List, Optional, Tuple
import aiomysql

from app.core.database import resolve_connection
from app.modules.works.models import Work
from app.utils import parse_json_safe


class WorkRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    # get all works with pagination
    async def get_all_works(
        self,
        page: int = 1,
        per_page: int = 25,
        query: Optional[str] = None,
        *,
        format_id: list[int] | None = None,
        status_id: list[int] | None = None,
        demographic_id: list[int] | None = None,
        genre_id: list[int] | None = None,
        sort: str = "relevance",
    ) -> Tuple[List[Work], int, int, int]:
        search_term = (query or "").strip()
        where_clauses: list[str] = []
        values: list[object] = []
        if search_term:
            like_term = f"%{search_term}%"
            if len(search_term) >= 3:
                where_clauses.append("""
                    (
                       MATCH(w.title, w.alternative_title, w.author, w.synopsis) AGAINST (%s IN BOOLEAN MODE)
                       OR w.title LIKE %s
                       OR w.alternative_title LIKE %s
                       OR w.author LIKE %s
                       OR sg.name LIKE %s
                    )
                """)
                values.extend([f"+{search_term}*", like_term, like_term, like_term, like_term])
            else:
                where_clauses.append("""
                    (
                       w.title LIKE %s
                       OR w.alternative_title LIKE %s
                       OR w.author LIKE %s
                       OR sg.name LIKE %s
                    )
                """)
                values.extend([like_term, like_term, like_term, like_term])

        if format_id:
            placeholders = ", ".join(["%s"] * len(format_id))
            where_clauses.append(f"w.format_id IN ({placeholders})")
            values.extend(format_id)

        if status_id:
            placeholders = ", ".join(["%s"] * len(status_id))
            where_clauses.append(f"w.status_id IN ({placeholders})")
            values.extend(status_id)

        if demographic_id:
            placeholders = ", ".join(["%s"] * len(demographic_id))
            where_clauses.append(f"w.demographic_id IN ({placeholders})")
            values.extend(demographic_id)

        if genre_id:
            placeholders = ", ".join(["%s"] * len(genre_id))
            where_clauses.append(f"""
                w.id IN (
                    SELECT wg.work_id
                    FROM work_genres wg
                    WHERE wg.genre_id IN ({placeholders})
                    GROUP BY wg.work_id
                    HAVING COUNT(DISTINCT wg.genre_id) = %s
                )
            """)
            values.extend(genre_id)
            values.append(len(genre_id))

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        sort_map = {
            "trending": "ws.trending_score DESC, ws.views_last_24h DESC",
            "views": "ws.total_views DESC",
            "rating": "ws.rating_average DESC, ws.rating_count DESC",
            "alphabetical": "w.title ASC",
            "newest": "w.id DESC",
        }
        order_by = sort_map.get(sort, "ws.trending_score DESC, w.id DESC")
        order_values: list[object] = []

        if sort == "relevance" and search_term:
            order_by = """
                CASE
                    WHEN w.title = %s THEN 0
                    WHEN w.title LIKE %s THEN 1
                    ELSE 2
                END,
                ws.trending_score DESC,
                w.id DESC
            """
            order_values = [search_term, f"{search_term}%"]

        count_joins = "LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id" if search_term else ""
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    f"""
                    SELECT COUNT(*) AS total
                    FROM works AS w
                    {count_joins}
                    {where_sql}
                    """,
                    tuple(values),
                )

                total_row = await cur.fetchone()
                total = total_row["total"] if total_row else 0
                last_visible_page = max(1, (total + per_page - 1) // per_page)
                current_page = min(max(1, page), last_visible_page)
                offset = (current_page - 1) * per_page

                query_values = list(values)
                query_values.extend(order_values)
                query_values.extend([per_page, offset])

                await cur.execute(
                    f"""
                    SELECT w.*,
                           ws.first_chapter_id,
                           COALESCE(ws.chapters_count, 0) AS chapters_count,
                           COALESCE(ws.total_views, 0) AS total_views,
                           COALESCE(ws.rating_average, 0.00) AS rating_average,
                           COALESCE(ws.rating_count, 0) AS rating_count,
                           COALESCE(ws.favorites_count, 0) AS favorites_count,
                           COALESCE(ws.trending_score, 0.00) AS trending_score,
                           COALESCE(ws.views_last_24h, 0) AS views_last_24h,
                           f.name AS format_name,
                           st.name AS status_name,
                           COALESCE(
                               (
                                   SELECT JSON_ARRAYAGG(JSON_OBJECT('id', g.id, 'name', g.name))
                                   FROM work_genres AS wg
                                   JOIN genres AS g ON g.id = wg.genre_id
                                   WHERE wg.work_id = w.id
                               ),
                               JSON_ARRAY()
                           ) AS genres_json
                    FROM works AS w
                    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                    LEFT JOIN formats AS f ON f.id = w.format_id
                    LEFT JOIN statuses AS st ON st.id = w.status_id
                    LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id
                    {where_sql}
                    ORDER BY {order_by}
                    LIMIT %s OFFSET %s
                    """,
                    tuple(query_values),
                )

                rows = await cur.fetchall()
                works = []
                for row in (rows or []):
                    row["genres"] = parse_json_safe(row.get("genres_json"), default=[])
                    works.append(Work(**row))

                return works, total, current_page, last_visible_page

    # cargar todos los filtros desde base de datos con union all
    async def get_filters(self) -> dict[str, list[dict[str, object]]]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("""
                    SELECT 'formats'      AS kind, id, name FROM formats
                    UNION ALL
                    SELECT 'statuses'     AS kind, id, name FROM statuses
                    UNION ALL
                    SELECT 'demographics' AS kind, id, name FROM demographics
                    UNION ALL
                    SELECT 'genres'       AS kind, id, name FROM genres
                    ORDER BY kind, name
                """)
                rows = await cur.fetchall()
        filters: dict[str, list[dict[str, object]]] = {
            "formats": [],
            "statuses": [],
            "demographics": [],
            "genres": [],
        }
        for row in rows:
            filters[row["kind"]].append({"id": row["id"], "name": row["name"]})

        return filters

    # get work by slug (con géneros en una sola consulta SQL)
    async def get_work_by_slug(self, slug: str) -> Optional[Work]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT w.*,
                           ws.first_chapter_id,
                           COALESCE(ws.chapters_count, 0) AS chapters_count,
                           COALESCE(ws.total_views, 0) AS total_views,
                           COALESCE(ws.rating_average, 0.00) AS rating_average,
                           COALESCE(ws.rating_count, 0) AS rating_count,
                           COALESCE(ws.favorites_count, 0) AS favorites_count,
                           COALESCE(ws.trending_score, 0.00) AS trending_score,
                           COALESCE(ws.views_last_24h, 0) AS views_last_24h,
                           f.name AS format_name,
                           st.name AS status_name,
                           COALESCE(
                               (
                                   SELECT JSON_ARRAYAGG(JSON_OBJECT('id', g.id, 'name', g.name))
                                   FROM work_genres AS wg
                                   JOIN genres AS g ON g.id = wg.genre_id
                                   WHERE wg.work_id = w.id
                               ),
                               JSON_ARRAY()
                           ) AS genres_json
                    FROM works AS w
                    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                    LEFT JOIN formats AS f ON f.id = w.format_id
                    LEFT JOIN statuses AS st ON st.id = w.status_id
                    WHERE w.slug = %s
                    LIMIT 1
                    """,
                    (slug,),
                )
                row = await cur.fetchone()
                if row:
                    row["genres"] = parse_json_safe(row.get("genres_json"), default=[])
                    return Work(**row)
        return None

    # Obtener toda la información consolidada de la ficha de obra (1 solo viaje a la base de datos)
    async def get_work_detail_data(
        self,
        slug_or_id: str,
        user_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                where_clause = "w.id = %s" if slug_or_id.isdigit() else "w.slug = %s"
                param = int(slug_or_id) if slug_or_id.isdigit() else slug_or_id

                await cur.execute(
                    f"""
                    SELECT w.*,
                           ws.first_chapter_id,
                           COALESCE(ws.chapters_count, 0) AS chapters_count,
                           COALESCE(ws.total_views, 0) AS total_views,
                           COALESCE(ws.rating_average, 0.00) AS rating_average,
                           COALESCE(ws.rating_count, 0) AS rating_count,
                           COALESCE(ws.favorites_count, 0) AS favorites_count,
                           COALESCE(ws.trending_score, 0.00) AS trending_score,
                           COALESCE(ws.views_last_24h, 0) AS views_last_24h,
                           f.name AS format_name,
                           st.name AS status_name,
                           COALESCE(
                               (
                                   SELECT JSON_ARRAYAGG(JSON_OBJECT('id', g.id, 'name', g.name))
                                   FROM work_genres AS wg
                                   JOIN genres AS g ON g.id = wg.genre_id
                                   WHERE wg.work_id = w.id
                               ),
                               JSON_ARRAY()
                           ) AS genres_json
                    FROM works AS w
                    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                    LEFT JOIN formats AS f ON f.id = w.format_id
                    LEFT JOIN statuses AS st ON st.id = w.status_id
                    WHERE {where_clause}
                    LIMIT 1
                    """,
                    (param,),
                )
                work_row = await cur.fetchone()
                if not work_row:
                    return None

                work_row["genres"] = parse_json_safe(work_row.get("genres_json"), default=[])
                work_id = work_row["id"]

                # 2. Capítulos publicados ordenados descendentemente
                await cur.execute(
                    """
                    SELECT id, chapter_number, title, slug, published_at
                    FROM chapters
                    WHERE work_id = %s AND status = 'PUBLISHED'
                    ORDER BY chapter_number DESC
                    """,
                    (work_id,),
                )
                chapters = await cur.fetchall() or []

                # 3. Estado del usuario registrado
                user_state = {
                    "in_library": False,
                    "library_status": None,
                    "user_rating": None,
                    "read_chapter_ids": [],
                    "reading_progress": None,
                }

                if user_id:
                    # En biblioteca
                    await cur.execute(
                        "SELECT status, rating FROM user_library WHERE user_id = %s AND work_id = %s",
                        (user_id, work_id),
                    )
                    lib_row = await cur.fetchone()
                    if lib_row:
                        if lib_row.get("status"):
                            user_state["in_library"] = True
                            user_state["library_status"] = lib_row["status"]
                        if lib_row.get("rating") is not None:
                            user_state["user_rating"] = float(lib_row["rating"])

                    # Capítulos leídos
                    await cur.execute(
                        "SELECT chapter_id FROM user_read_chapters WHERE user_id = %s AND work_id = %s",
                        (user_id, work_id),
                    )
                    read_rows = await cur.fetchall() or []
                    user_state["read_chapter_ids"] = [r["chapter_id"] for r in read_rows]

                    # Progreso de lectura
                    await cur.execute(
                        """
                        SELECT rh.chapter_id, rh.last_page_read, rh.read_at, c.chapter_number
                        FROM reading_history rh
                        JOIN chapters c ON c.id = rh.chapter_id
                        WHERE rh.user_id = %s AND rh.work_id = %s
                        LIMIT 1
                        """,
                        (user_id, work_id),
                    )
                    prog_row = await cur.fetchone()
                    if prog_row:
                        user_state["reading_progress"] = {
                            "chapter_id": prog_row["chapter_id"],
                            "chapter_number": prog_row["chapter_number"],
                            "last_page_read": prog_row["last_page_read"] or 1,
                            "read_at": prog_row["read_at"],
                        }

                # 4. Estadísticas comunitarias por estado de biblioteca
                await cur.execute(
                    """
                    SELECT status, COUNT(*) AS cnt
                    FROM user_library
                    WHERE work_id = %s AND status IS NOT NULL
                    GROUP BY status
                    """,
                    (work_id,),
                )
                status_rows = await cur.fetchall() or []
                lib_stats = {
                    "reading": 0,
                    "plan_to_read": 0,
                    "completed": 0,
                    "on_hold": 0,
                    "dropped": 0,
                    "total": 0,
                }
                for sr in status_rows:
                    st = (sr.get("status") or "").lower()
                    cnt = int(sr.get("cnt") or 0)
                    if st in lib_stats:
                        lib_stats[st] += cnt
                    lib_stats["total"] += cnt

                return {
                    "work": work_row,
                    "chapters": chapters,
                    "user_state": user_state,
                    "library_stats": lib_stats,
                }

    async def create_work(self, work: Work) -> Work:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO works (
                        title,
                        slug,
                        alternative_title,
                        synopsis,
                        author,
                        cover_url,
                        banner_url,
                        status_id,
                        format_id,
                        demographic_id,
                        scan_group_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = (
                    work.title,
                    work.slug,
                    work.alternative_title,
                    work.synopsis,
                    work.author,
                    work.cover_url,
                    work.banner_url,
                    work.status_id,
                    work.format_id,
                    work.demographic_id,
                    work.scan_group_id,
                )
                await cur.execute(query, values)
                work.id = cur.lastrowid

                await cur.execute(
                    """
                    INSERT INTO work_statistics (
                        work_id, total_views, daily_views, weekly_views, monthly_views,
                        rating_average, rating_count, trending_score, views_last_24h, favorites_count
                    )
                    VALUES (%s, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0)
                    ON DUPLICATE KEY UPDATE work_id = VALUES(work_id)
                    """,
                    (work.id,),
                )
                if self.conn is None:
                    await conn.commit()
                return work

    async def get_work_by_id(self, work_id: int) -> Optional[Work]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT w.*,
                           COALESCE(ws.total_views, 0) AS total_views,
                           COALESCE(ws.rating_average, 0.00) AS rating_average,
                           COALESCE(ws.rating_count, 0) AS rating_count,
                           COALESCE(ws.favorites_count, 0) AS favorites_count,
                           COALESCE(ws.trending_score, 0.00) AS trending_score,
                           COALESCE(ws.views_last_24h, 0) AS views_last_24h
                    FROM works AS w
                    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                    WHERE w.id = %s
                    """,
                    (work_id,),
                )
                row = await cur.fetchone()
                if row:
                    return Work(**row)
        return None

    async def update_work(self, work: Work) -> Work:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    UPDATE works
                    SET title = %s,
                        slug = %s,
                        alternative_title = %s,
                        synopsis = %s,
                        author = %s,
                        cover_url = %s,
                        banner_url = %s,
                        status_id = %s,
                        format_id = %s,
                        demographic_id = %s,
                        scan_group_id = %s
                    WHERE id = %s
                """
                values = (
                    work.title,
                    work.slug,
                    work.alternative_title,
                    work.synopsis,
                    work.author,
                    work.cover_url,
                    work.banner_url,
                    work.status_id,
                    work.format_id,
                    work.demographic_id,
                    work.scan_group_id,
                    work.id,
                )
                await cur.execute(query, values)
                if self.conn is None:
                    await conn.commit()
                return work

    async def delete_work(self, work_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM works WHERE id = %s", (work_id,))
                if self.conn is None:
                    await conn.commit()
        return True

    async def get_search_suggestions(self, q: str, limit: int = 7) -> list[dict]:
        clean_q = (q or "").strip()
        if not clean_q:
            return []

        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                # Si empieza por @, buscar usuarios
                if clean_q.startswith("@"):
                    user_q = clean_q[1:].strip()
                    if not user_q:
                        return []
                    param = f"%{user_q}%"
                    await cur.execute(
                        """
                        SELECT user_code, username, avatar_url, platform_role
                        FROM users
                        WHERE username LIKE %s OR user_code LIKE %s
                        LIMIT %s
                        """,
                        (param, param, limit),
                    )
                    rows = await cur.fetchall() or []
                    return [
                        {
                            "type": "user",
                            "title": r["username"],
                            "subtitle": f"ID: {r['user_code']}" if r.get("user_code") else r.get("platform_role", "Usuario"),
                            "image_url": r.get("avatar_url"),
                            "url": f"/pages/usuario.html?id={r['user_code'] or r['username']}",
                            "badge": "Usuario",
                        }
                        for r in rows
                    ]

                # Búsqueda general de obras
                param = f"%{clean_q}%"
                await cur.execute(
                    """
                    SELECT id, title, alternative_title, slug, author, cover_url
                    FROM works
                    WHERE title LIKE %s OR alternative_title LIKE %s OR author LIKE %s
                    LIMIT %s
                    """,
                    (param, param, param, limit),
                )
                rows = await cur.fetchall() or []
                results = []
                for r in rows:
                    meta_parts = [p for p in (r.get("author"), r.get("alternative_title")) if p]
                    subtitle = " · ".join(meta_parts[:2]) if meta_parts else "Obra"
                    results.append({
                        "type": "work",
                        "title": r["title"],
                        "subtitle": subtitle,
                        "image_url": r.get("cover_url"),
                        "url": f"/pages/obra.html?slug={r['slug']}",
                        "badge": "Obra",
                    })
                return results