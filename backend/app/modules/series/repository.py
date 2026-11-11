from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import bindparam, delete, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.series.models import (
    WorkGenreORM,
    WorkORM,
    WorkStatisticsORM,
)
from app.modules.chapters.models import ChapterORM
from app.modules.users.models import (
    ReadingHistoryORM,
    UserLibraryORM,
    UserReadChapterORM,
)
from app.modules.users.models import UserORM
from app.modules.series.schemas import Work
from app.utils.formatters import parse_json_safe


class WorkRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

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
        params: Dict[str, Any] = {}
        expanding_params = []

        if search_term:
            params["like_term"] = f"%{search_term}%"
            where_clauses.append(
                """
                (
                   w.title ILIKE :like_term
                   OR w.alternative_title ILIKE :like_term
                   OR w.author ILIKE :like_term
                   OR w.synopsis ILIKE :like_term
                   OR sg.name ILIKE :like_term
                )
                """
            )

        if format_id:
            where_clauses.append("w.format_id IN :format_ids")
            params["format_ids"] = list(format_id)
            expanding_params.append(bindparam("format_ids", expanding=True))

        if status_id:
            where_clauses.append("w.status_id IN :status_ids")
            params["status_ids"] = list(status_id)
            expanding_params.append(bindparam("status_ids", expanding=True))

        if demographic_id:
            where_clauses.append("w.demographic_id IN :demographic_ids")
            params["demographic_ids"] = list(demographic_id)
            expanding_params.append(bindparam("demographic_ids", expanding=True))

        if genre_id:
            where_clauses.append(
                """
                w.id IN (
                    SELECT wg.work_id
                    FROM work_genres wg
                    WHERE wg.genre_id IN :genre_ids
                    GROUP BY wg.work_id
                    HAVING COUNT(DISTINCT wg.genre_id) = :genre_count
                )
                """
            )
            params["genre_ids"] = list(genre_id)
            params["genre_count"] = len(genre_id)
            expanding_params.append(bindparam("genre_ids", expanding=True))

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        sort_map = {
            "trending": "COALESCE(ws.trending_score, 0) DESC, COALESCE(ws.views_last_24h, 0) DESC",
            "views": "COALESCE(ws.total_views, 0) DESC",
            "rating": "COALESCE(ws.rating_average, 0) DESC, COALESCE(ws.rating_count, 0) DESC",
            "alphabetical": "w.title ASC",
            "newest": "w.id DESC",
        }
        order_by = sort_map.get(sort, "COALESCE(ws.trending_score, 0) DESC, w.id DESC")

        if sort == "relevance" and search_term:
            order_by = """
                CASE
                    WHEN LOWER(w.title) = LOWER(:exact_search) THEN 0
                    WHEN w.title ILIKE :prefix_search THEN 1
                    ELSE 2
                END,
                COALESCE(ws.trending_score, 0) DESC,
                w.id DESC
            """
            params["exact_search"] = search_term
            params["prefix_search"] = f"{search_term}%"

        count_joins = (
            "LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id"
            if search_term
            else ""
        )

        async with resolve_session(self.conn) as session:
            count_stmt = text(
                f"""
                SELECT COUNT(*) AS total
                FROM works AS w
                {count_joins}
                {where_sql}
                """
            )
            if expanding_params:
                count_stmt = count_stmt.bindparams(*expanding_params)

            total_res = await session.execute(count_stmt, params)
            total = int(total_res.scalar() or 0)
            last_visible_page = max(1, (total + per_page - 1) // per_page)
            current_page = min(max(1, page), last_visible_page)
            offset = (current_page - 1) * per_page

            query_params = dict(params)
            query_params["limit"] = per_page
            query_params["offset"] = offset

            data_stmt = text(
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
                               SELECT json_agg(json_build_object('id', g.id, 'name', g.name))
                               FROM work_genres AS wg
                               JOIN genres AS g ON g.id = wg.genre_id
                               WHERE wg.work_id = w.id
                           ),
                           '[]'::json
                       ) AS genres_json
                FROM works AS w
                LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                LEFT JOIN formats AS f ON f.id = w.format_id
                LEFT JOIN statuses AS st ON st.id = w.status_id
                LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id
                {where_sql}
                ORDER BY {order_by}
                LIMIT :limit OFFSET :offset
                """
            )
            if expanding_params:
                data_stmt = data_stmt.bindparams(*expanding_params)

            rows_res = await session.execute(data_stmt, query_params)
            works = []
            for r in rows_res.mappings().all():
                row = dict(r)
                raw_genres = row.get("genres_json")
                row["genres"] = (
                    raw_genres
                    if isinstance(raw_genres, list)
                    else parse_json_safe(raw_genres, default=[])
                )
                works.append(Work(**row))

            return works, total, current_page, last_visible_page

    async def get_filters(self) -> dict[str, list[dict[str, object]]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT 'formats'      AS kind, id, name FROM formats
                    UNION ALL
                    SELECT 'statuses'     AS kind, id, name FROM statuses
                    UNION ALL
                    SELECT 'demographics' AS kind, id, name FROM demographics
                    UNION ALL
                    SELECT 'genres'       AS kind, id, name FROM genres
                    ORDER BY kind, name
                    """
                )
            )
            rows = res.mappings().all()

        filters: dict[str, list[dict[str, object]]] = {
            "formats": [],
            "statuses": [],
            "demographics": [],
            "genres": [],
        }
        for row in rows:
            filters[row["kind"]].append({"id": row["id"], "name": row["name"]})
        return filters

    async def get_work_by_slug(self, slug: str) -> Optional[Work]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
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
                                   SELECT json_agg(json_build_object('id', g.id, 'name', g.name))
                                   FROM work_genres AS wg
                                   JOIN genres AS g ON g.id = wg.genre_id
                                   WHERE wg.work_id = w.id
                               ),
                               '[]'::json
                           ) AS genres_json
                    FROM works AS w
                    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                    LEFT JOIN formats AS f ON f.id = w.format_id
                    LEFT JOIN statuses AS st ON st.id = w.status_id
                    WHERE w.slug = :slug
                    LIMIT 1
                    """
                ),
                {"slug": slug},
            )
            r = res.mappings().first()
            if r:
                row = dict(r)
                raw_genres = row.get("genres_json")
                row["genres"] = (
                    raw_genres
                    if isinstance(raw_genres, list)
                    else parse_json_safe(raw_genres, default=[])
                )
                return Work(**row)
        return None

    async def get_work_detail_data(
        self,
        slug_or_id: str,
        user_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            where_clause = (
                "w.id = :param" if slug_or_id.isdigit() else "w.slug = :param"
            )
            param = int(slug_or_id) if slug_or_id.isdigit() else slug_or_id

            res = await session.execute(
                text(
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
                                   SELECT json_agg(json_build_object('id', g.id, 'name', g.name))
                                   FROM work_genres AS wg
                                   JOIN genres AS g ON g.id = wg.genre_id
                                   WHERE wg.work_id = w.id
                               ),
                               '[]'::json
                           ) AS genres_json
                    FROM works AS w
                    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                    LEFT JOIN formats AS f ON f.id = w.format_id
                    LEFT JOIN statuses AS st ON st.id = w.status_id
                    WHERE {where_clause}
                    LIMIT 1
                    """
                ),
                {"param": param},
            )
            w_map = res.mappings().first()
            if not w_map:
                return None

            work_row = dict(w_map)
            raw_genres = work_row.get("genres_json")
            work_row["genres"] = (
                raw_genres
                if isinstance(raw_genres, list)
                else parse_json_safe(raw_genres, default=[])
            )
            work_id = work_row["id"]

            chap_res = await session.execute(
                select(
                    ChapterORM.id,
                    ChapterORM.chapter_number,
                    ChapterORM.title,
                    ChapterORM.slug,
                    ChapterORM.published_at,
                )
                .where(
                    ChapterORM.work_id == work_id,
                    ChapterORM.status == "PUBLISHED",
                )
                .order_by(ChapterORM.chapter_number.desc())
            )
            chapters = [dict(r) for r in chap_res.mappings().all()]

            user_state: dict[str, Any] = {
                "in_library": False,
                "library_status": None,
                "user_rating": None,
                "read_chapter_ids": [],
                "reading_progress": None,
            }

            if user_id:
                lib_res = await session.execute(
                    select(UserLibraryORM.status, UserLibraryORM.rating).where(
                        UserLibraryORM.user_id == user_id,
                        UserLibraryORM.work_id == work_id,
                    )
                )
                lib_row = lib_res.mappings().first()
                if lib_row:
                    if lib_row.get("status"):
                        user_state["in_library"] = True
                        user_state["library_status"] = lib_row["status"]
                    if lib_row.get("rating") is not None:
                        user_state["user_rating"] = float(lib_row["rating"])

                read_res = await session.execute(
                    select(UserReadChapterORM.chapter_id).where(
                        UserReadChapterORM.user_id == user_id,
                        UserReadChapterORM.work_id == work_id,
                    )
                )
                user_state["read_chapter_ids"] = list(read_res.scalars().all())

                prog_res = await session.execute(
                    select(
                        ReadingHistoryORM.chapter_id,
                        ReadingHistoryORM.last_page_read,
                        ReadingHistoryORM.read_at,
                        ChapterORM.chapter_number,
                    )
                    .join(
                        ChapterORM,
                        ChapterORM.id == ReadingHistoryORM.chapter_id,
                    )
                    .where(
                        ReadingHistoryORM.user_id == user_id,
                        ReadingHistoryORM.work_id == work_id,
                    )
                    .limit(1)
                )
                prog_row = prog_res.mappings().first()
                if prog_row:
                    user_state["reading_progress"] = {
                        "chapter_id": prog_row["chapter_id"],
                        "chapter_number": prog_row["chapter_number"],
                        "last_page_read": prog_row["last_page_read"] or 1,
                        "read_at": prog_row["read_at"],
                    }

            status_res = await session.execute(
                text(
                    """
                    SELECT status, COUNT(*) AS cnt
                    FROM user_library
                    WHERE work_id = :wid AND status IS NOT NULL
                    GROUP BY status
                    """
                ),
                {"wid": work_id},
            )
            lib_stats = {
                "reading": 0,
                "plan_to_read": 0,
                "completed": 0,
                "on_hold": 0,
                "dropped": 0,
                "total": 0,
            }
            for sr in status_res.mappings().all():
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
        async with resolve_session(self.conn) as session:
            new_work = WorkORM(
                title=work.title,
                slug=work.slug,
                alternative_title=work.alternative_title,
                synopsis=work.synopsis,
                author=work.author,
                cover_url=work.cover_url,
                banner_url=work.banner_url,
                status_id=work.status_id,
                format_id=work.format_id,
                demographic_id=work.demographic_id,
                scan_group_id=work.scan_group_id,
            )
            session.add(new_work)
            await session.flush()
            work.id = new_work.id

            stats_stmt = (
                pg_insert(WorkStatisticsORM)
                .values(work_id=work.id)
                .on_conflict_do_nothing(
                    index_elements=[WorkStatisticsORM.work_id]
                )
            )
            await session.execute(stats_stmt)
            await session.commit()
            return work

    async def get_work_by_id(self, work_id: int) -> Optional[Work]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
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
                    WHERE w.id = :wid
                    """
                ),
                {"wid": work_id},
            )
            r = res.mappings().first()
            if r:
                return Work(**dict(r))
        return None

    async def update_work(self, work: Work) -> Work:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(WorkORM)
                .where(WorkORM.id == work.id)
                .values(
                    title=work.title,
                    slug=work.slug,
                    alternative_title=work.alternative_title,
                    synopsis=work.synopsis,
                    author=work.author,
                    cover_url=work.cover_url,
                    banner_url=work.banner_url,
                    status_id=work.status_id,
                    format_id=work.format_id,
                    demographic_id=work.demographic_id,
                    scan_group_id=work.scan_group_id,
                )
            )
            await session.commit()
            return work

    async def set_work_genres(self, work_id: int, genre_ids: list[int]) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                delete(WorkGenreORM).where(WorkGenreORM.work_id == work_id)
            )
            clean_ids = list({int(gid) for gid in (genre_ids or []) if gid})
            if clean_ids:
                stmt = (
                    pg_insert(WorkGenreORM)
                    .values([{"work_id": work_id, "genre_id": gid} for gid in clean_ids])
                    .on_conflict_do_nothing()
                )
                await session.execute(stmt)
            await session.commit()

    async def delete_work(self, work_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            await session.execute(delete(WorkORM).where(WorkORM.id == work_id))
            await session.commit()
        return True

    async def get_search_suggestions(self, q: str, limit: int = 7) -> list[dict]:
        clean_q = (q or "").strip()
        if not clean_q:
            return []

        async with resolve_session(self.conn) as session:
            if clean_q.startswith("@"):
                user_q = clean_q[1:].strip()
                if not user_q:
                    return []
                param = f"%{user_q}%"
                res = await session.execute(
                    select(
                        UserORM.user_code,
                        UserORM.username,
                        UserORM.avatar_url,
                        UserORM.platform_role,
                    )
                    .where(
                        or_(
                            UserORM.username.ilike(param),
                            UserORM.user_code.ilike(param),
                        )
                    )
                    .limit(limit)
                )
                rows = res.mappings().all()
                return [
                    {
                        "type": "user",
                        "title": r["username"],
                        "subtitle": (
                            f"ID: {r['user_code']}"
                            if r.get("user_code")
                            else r.get("platform_role", "Usuario")
                        ),
                        "image_url": r.get("avatar_url"),
                        "url": f"/pages/usuario.html?id={r['user_code'] or r['username']}",
                        "badge": "Usuario",
                    }
                    for r in rows
                ]

            param = f"%{clean_q}%"
            res = await session.execute(
                select(
                    WorkORM.id,
                    WorkORM.title,
                    WorkORM.alternative_title,
                    WorkORM.slug,
                    WorkORM.author,
                    WorkORM.cover_url,
                )
                .where(
                    or_(
                        WorkORM.title.ilike(param),
                        WorkORM.alternative_title.ilike(param),
                        WorkORM.author.ilike(param),
                    )
                )
                .limit(limit)
            )
            results = []
            for r in res.mappings().all():
                meta_parts = [
                    p
                    for p in (r.get("author"), r.get("alternative_title"))
                    if p
                ]
                subtitle = " · ".join(meta_parts[:2]) if meta_parts else "Obra"
                results.append(
                    {
                        "type": "work",
                        "title": r["title"],
                        "subtitle": subtitle,
                        "image_url": r.get("cover_url"),
                        "url": f"/pages/obra.html?slug={r['slug']}",
                        "badge": "Obra",
                    }
                )
            return results
