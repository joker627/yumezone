from typing import List, Optional, Tuple

import aiomysql

from app.core.database import get_db_pool
from app.modules.works.models import Work


class WorkRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn  # Recibe la conexión

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
            where_clauses.append("""
                (
                   INSTR(LOWER(COALESCE(w.title, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(w.alternative_title, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(w.slug, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(w.author, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(w.synopsis, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(sg.name, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(st.name, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(f.name, '')), LOWER(%s)) > 0
                   OR INSTR(LOWER(COALESCE(d.name, '')), LOWER(%s)) > 0
                   OR EXISTS (
                       SELECT 1
                       FROM work_genres AS wg
                       JOIN genres AS g ON g.id = wg.genre_id
                       WHERE wg.work_id = w.id
                         AND INSTR(LOWER(g.name), LOWER(%s)) > 0
                   )
                   OR EXISTS (
                       SELECT 1
                       FROM work_tags AS wt
                       JOIN tags AS t ON t.id = wt.tag_id
                       WHERE wt.work_id = w.id
                         AND INSTR(LOWER(t.name), LOWER(%s)) > 0
                   )
                   OR EXISTS (
                       SELECT 1
                       FROM chapters AS c
                       WHERE c.work_id = w.id
                         AND INSTR(LOWER(COALESCE(c.title, '')), LOWER(%s)) > 0
                   )
                )
            """)
            values.extend([search_term] * 12)

        for column, selected_values in (
            ("w.format_id", format_id),
            ("w.status_id", status_id),
            ("w.demographic_id", demographic_id),
        ):
            selected_ids = list(
                dict.fromkeys(value for value in (selected_values or []) if value > 0)
            )
            if selected_ids:
                placeholders = ", ".join("%s" for _ in selected_ids)
                where_clauses.append(f"{column} IN ({placeholders})")
                values.extend(selected_ids)

        selected_genres = list(
            dict.fromkeys(value for value in (genre_id or []) if value > 0)
        )
        if selected_genres:
            placeholders = ", ".join("%s" for _ in selected_genres)
            where_clauses.append(f"""
                EXISTS (
                    SELECT 1
                    FROM work_genres AS filter_wg
                    WHERE filter_wg.work_id = w.id
                      AND filter_wg.genre_id IN ({placeholders})
                )
            """)
            values.extend(selected_genres)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        order_by = {
            "popular": "COALESCE(ws.trending_score, 0) DESC, w.id DESC",
            "recent": "w.created_at DESC, w.id DESC",
            "title": "w.title ASC, w.id ASC",
        }.get(sort, "COALESCE(ws.trending_score, 0) DESC, w.id DESC")
        order_values: list[str] = []
        if sort == "relevance" and search_term:
            order_by = """
                CASE
                    WHEN LOWER(w.title) = LOWER(%s) THEN 0
                    WHEN INSTR(LOWER(w.title), LOWER(%s)) = 1 THEN 1
                    ELSE 2
                END,
                COALESCE(ws.trending_score, 0) DESC,
                w.id DESC
            """
            order_values = [search_term, search_term]

        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM works AS w
                LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id
                LEFT JOIN statuses AS st ON st.id = w.status_id
                LEFT JOIN formats AS f ON f.id = w.format_id
                LEFT JOIN demographics AS d ON d.id = w.demographic_id
                {where_sql}
                """,
                tuple(values),
            )

            total_row = await cur.fetchone()
            total = total_row["total"] if total_row else 0
            last_visible_page = max(1, (total + per_page - 1) // per_page)
            current_page = min(max(page, 1), last_visible_page)
            offset = (current_page - 1) * per_page

            await cur.execute(
                f"""
                SELECT w.*,
                       (
                           SELECT c.id
                           FROM chapters AS c
                           WHERE c.work_id = w.id AND c.status = 'PUBLISHED'
                           ORDER BY c.chapter_number ASC, c.id ASC
                           LIMIT 1
                       ) AS first_chapter_id,
                       COALESCE(ws.total_views, 0) AS total_views,
                       COALESCE(ws.rating_average, 0.00) AS rating_average,
                       COALESCE(ws.rating_count, 0) AS rating_count,
                       COALESCE(ws.followers_count, 0) AS followers_count,
                       COALESCE(ws.favorites_count, 0) AS favorites_count,
                       COALESCE(ws.trending_score, 0.00) AS trending_score,
                       COALESCE(ws.views_last_24h, 0) AS views_last_24h
                FROM works AS w
                LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id
                LEFT JOIN statuses AS st ON st.id = w.status_id
                LEFT JOIN formats AS f ON f.id = w.format_id
                LEFT JOIN demographics AS d ON d.id = w.demographic_id
                LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                {where_sql}
                ORDER BY {order_by}
                LIMIT %s OFFSET %s
                """,
                (*values, *order_values, per_page, offset),
            )
            rows = await cur.fetchall()
            works = [Work(**row) for row in rows] if rows else []

            return works, total, current_page, last_visible_page

    async def get_filters(self) -> dict[str, list[dict[str, object]]]:
        """Carga todos los filtros en una sola query con UNION ALL."""
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
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

    # get work by slug
    async def get_work_by_slug(self, slug: str) -> Optional[Work]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT w.*,
                       (
                           SELECT c.id
                           FROM chapters AS c
                           WHERE c.work_id = w.id AND c.status = 'PUBLISHED'
                           ORDER BY c.chapter_number ASC, c.id ASC
                           LIMIT 1
                       ) AS first_chapter_id,
                       COALESCE(ws.total_views, 0) AS total_views,
                       COALESCE(ws.rating_average, 0.00) AS rating_average,
                       COALESCE(ws.rating_count, 0) AS rating_count,
                       COALESCE(ws.followers_count, 0) AS followers_count,
                       COALESCE(ws.favorites_count, 0) AS favorites_count,
                       COALESCE(ws.trending_score, 0.00) AS trending_score,
                       COALESCE(ws.views_last_24h, 0) AS views_last_24h
                FROM works AS w
                LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                WHERE w.slug = %s
                """,
                (slug,),
            )
            row = await cur.fetchone()
            if row:
                await cur.execute(
                    """
                    SELECT g.id, g.name
                    FROM genres AS g
                    JOIN work_genres AS wg ON wg.genre_id = g.id
                    WHERE wg.work_id = %s
                    ORDER BY g.name
                    """,
                    (row["id"],),
                )
                row["genres"] = await cur.fetchall() or []
                return Work(**row)
        return None

    # create a new work
    async def create_work(self, work: Work) -> Work:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
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
                await conn.commit()
                work.id = cur.lastrowid
                return work

    # get work by id
    async def get_work_by_id(self, work_id: int) -> Optional[Work]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT w.*,
                           COALESCE(ws.total_views, 0) AS total_views,
                           COALESCE(ws.rating_average, 0.00) AS rating_average,
                           COALESCE(ws.rating_count, 0) AS rating_count,
                           COALESCE(ws.followers_count, 0) AS followers_count,
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

    # update work
    async def update_work(self, work: Work) -> Work:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
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
                await conn.commit()
                return work

    # delete work
    async def delete_work(self, work_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM works WHERE id = %s",
                    (work_id,),
                )
                await conn.commit()
        return True
