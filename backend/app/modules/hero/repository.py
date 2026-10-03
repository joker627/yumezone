import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import aiomysql

WORK_QUERY = """
    SELECT w.id, w.title, w.slug, w.alternative_title, w.synopsis,
           w.author, w.cover_url, w.banner_url,
           sg.id AS scan_group_id, sg.name AS scan_group_name,
           sg.slug AS scan_group_slug, sg.logo_url AS scan_group_logo_url,
           COALESCE(ws.total_views, 0) AS total_views,
           COALESCE(ws.rating_average, 0.00) AS rating_average,
           COALESCE(ws.rating_count, 0) AS rating_count,
           COALESCE(ws.followers_count, 0) AS followers_count,
           COALESCE(ws.favorites_count, 0) AS favorites_count,
           COALESCE(ws.trending_score, 0.00) AS trending_score
    FROM works AS w
    LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id
    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
"""


class HeroRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def get_groups(self) -> Dict[str, List[Dict[str, Any]]]:
        return {
            "top": await self._get_group(
                "ORDER BY COALESCE(ws.trending_score, 0) DESC, w.id DESC"
            ),
            "popular": await self._get_group(
                "ORDER BY COALESCE(ws.weekly_views, 0) DESC, "
                "COALESCE(ws.total_views, 0) DESC, w.id DESC"
            ),
            "new": await self._get_new_group(),
        }

    async def _get_group(self, order_by: str) -> List[Dict[str, Any]]:
        return await self._fetch_works(f"{WORK_QUERY} {order_by} LIMIT 3")

    async def _get_new_group(self) -> List[Dict[str, Any]]:
        query = f"""
            {WORK_QUERY}
            JOIN hero_new_queue AS hq ON hq.work_id = w.id
            WHERE hq.status = 'ACTIVE'
              AND (hq.expires_at IS NULL OR hq.expires_at > NOW())
            ORDER BY hq.activated_at ASC, hq.id ASC
            LIMIT 3
        """
        return await self._fetch_works(query)

    async def enrich_work(
        self, work: Dict[str, Any], user_id: Optional[int]
    ) -> Dict[str, Any]:
        work_id = work["id"]
        genres = await self._fetch(
            """
            SELECT g.id, g.name
            FROM genres AS g
            JOIN work_genres AS wg ON wg.genre_id = g.id
            WHERE wg.work_id = %s
            ORDER BY g.name
            """,
            (work_id,),
        )
        latest = await self._fetch_one(
            """
            SELECT c.id, c.chapter_number AS number, c.title,
                   c.published_at, sg.name AS scan_group_name
            FROM chapters AS c
            LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
            WHERE c.work_id = %s AND c.status = 'PUBLISHED'
            ORDER BY c.chapter_number DESC, c.published_at DESC
            LIMIT 1
            """,
            (work_id,),
        )
        next_chapter = await self._fetch_one(
            """
            SELECT c.id, c.chapter_number AS number, c.title, c.status,
                   sg.name AS scan_group_name
            FROM chapters AS c
            LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
            WHERE c.work_id = %s AND c.status = 'SCHEDULED'
            ORDER BY c.chapter_number ASC
            LIMIT 1
            """,
            (work_id,),
        )
        first_chapter = await self._fetch_one(
            """
            SELECT id, chapter_number AS number
            FROM chapters
            WHERE work_id = %s AND status = 'PUBLISHED'
            ORDER BY chapter_number ASC
            LIMIT 1
            """,
            (work_id,),
        )
        library = await self._fetch_one(
            """
            SELECT COUNT(*) AS count,
                   MAX(CASE WHEN user_id = %s THEN 1 ELSE 0 END) AS is_added,
                   MAX(CASE WHEN user_id = %s AND notify_new_chapters = TRUE
                            THEN 1 ELSE 0 END) AS is_subscribed
            FROM user_library
            WHERE work_id = %s
            """,
            (user_id or 0, user_id or 0, work_id),
        )
        return {
            "work": work,
            "genres": genres,
            "latest": latest,
            "next": next_chapter,
            "first": first_chapter,
            "library": library or {"count": 0, "is_added": 0, "is_subscribed": 0},
        }

    async def rotate_new_queue(self, limit: int = 3) -> None:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT setting_value
                FROM platform_settings
                WHERE setting_key = 'hero_new_rotation_hours'
                """)
            setting = await cur.fetchone()
            hours = 24
            if setting and setting["setting_value"]:
                try:
                    value = setting["setting_value"]
                    if isinstance(value, str):
                        value = json.loads(value)
                    hours = int(value["hours"])
                except (ValueError, KeyError, TypeError, json.JSONDecodeError):
                    hours = 24
            await cur.execute("""
                UPDATE hero_new_queue
                SET status = 'EXPIRED'
                WHERE status = 'ACTIVE' AND expires_at IS NOT NULL
                  AND expires_at <= NOW()
                """)
            await cur.execute(
                """
                SELECT id FROM hero_new_queue
                WHERE status = 'PENDING'
                ORDER BY queued_at ASC, id ASC
                LIMIT %s
                """,
                (limit,),
            )
            pending = await cur.fetchall()
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=hours)).replace(
                tzinfo=None
            )
            for item in pending:
                await cur.execute(
                    """
                    UPDATE hero_new_queue
                    SET status = 'ACTIVE', activated_at = NOW(), expires_at = %s
                    WHERE id = %s
                    """,
                    (expires_at, item["id"]),
                )
            await self.conn.commit()

    async def _fetch_works(self, query: str) -> List[Dict[str, Any]]:
        return await self._fetch(query, ())

    async def _fetch(self, query: str, values: tuple[Any, ...]) -> List[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, values)
            return await cur.fetchall()

    async def _fetch_one(
        self, query: str, values: tuple[Any, ...]
    ) -> Optional[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, values)
            return await cur.fetchone()
