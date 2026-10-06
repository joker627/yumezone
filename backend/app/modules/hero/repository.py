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

    async def enrich_works_batch(
        self, works: List[Dict[str, Any]], user_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Carga géneros, capítulos y biblioteca para todas las obras en 4 queries."""
        if not works:
            return []

        ids = [w["id"] for w in works]
        placeholders = ", ".join("%s" for _ in ids)

        # 1. Géneros de todas las obras (1 query)
        genres_rows = await self._fetch(
            f"""
            SELECT wg.work_id, g.id, g.name
            FROM work_genres AS wg
            JOIN genres AS g ON g.id = wg.genre_id
            WHERE wg.work_id IN ({placeholders})
            ORDER BY g.name
            """,
            tuple(ids),
        )
        genres_map: Dict[int, list] = {wid: [] for wid in ids}
        for row in genres_rows:
            genres_map[row["work_id"]].append({"id": row["id"], "name": row["name"]})

        # 2. Último capítulo publicado por obra (1 query con ROW_NUMBER)
        latest_rows = await self._fetch(
            f"""
            SELECT c.work_id, c.id, c.chapter_number AS number, c.title,
                   c.published_at, sg.name AS scan_group_name
            FROM chapters AS c
            LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
            WHERE c.work_id IN ({placeholders})
              AND c.status = 'PUBLISHED'
              AND c.chapter_number = (
                  SELECT MAX(c2.chapter_number)
                  FROM chapters AS c2
                  WHERE c2.work_id = c.work_id AND c2.status = 'PUBLISHED'
              )
            """,
            tuple(ids),
        )
        latest_map: Dict[int, Optional[Dict]] = {wid: None for wid in ids}
        for row in latest_rows:
            latest_map[row["work_id"]] = row

        # 3. Primer capítulo publicado por obra (1 query)
        first_rows = await self._fetch(
            f"""
            SELECT c.work_id, c.id, c.chapter_number AS number
            FROM chapters AS c
            WHERE c.work_id IN ({placeholders})
              AND c.status = 'PUBLISHED'
              AND c.chapter_number = (
                  SELECT MIN(c2.chapter_number)
                  FROM chapters AS c2
                  WHERE c2.work_id = c.work_id AND c2.status = 'PUBLISHED'
              )
            """,
            tuple(ids),
        )
        first_map: Dict[int, Optional[Dict]] = {wid: None for wid in ids}
        for row in first_rows:
            first_map[row["work_id"]] = row

        # 4. Próximo capítulo programado (1 query)
        next_rows = await self._fetch(
            f"""
            SELECT c.work_id, c.id, c.chapter_number AS number, c.title,
                   c.status, sg.name AS scan_group_name
            FROM chapters AS c
            LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
            WHERE c.work_id IN ({placeholders})
              AND c.status = 'SCHEDULED'
              AND c.chapter_number = (
                  SELECT MIN(c2.chapter_number)
                  FROM chapters AS c2
                  WHERE c2.work_id = c.work_id AND c2.status = 'SCHEDULED'
              )
            """,
            tuple(ids),
        )
        next_map: Dict[int, Optional[Dict]] = {wid: None for wid in ids}
        for row in next_rows:
            next_map[row["work_id"]] = row

        # 5. Estado de biblioteca del usuario (1 query)
        library_rows = await self._fetch(
            f"""
            SELECT work_id,
                   COUNT(*) AS count,
                   MAX(CASE WHEN user_id = %s THEN 1 ELSE 0 END) AS is_added,
                   MAX(CASE WHEN user_id = %s AND notify_new_chapters = TRUE
                            THEN 1 ELSE 0 END) AS is_subscribed
            FROM user_library
            WHERE work_id IN ({placeholders})
            GROUP BY work_id
            """,
            (user_id or 0, user_id or 0, *ids),
        )
        library_map: Dict[int, Dict] = {
            wid: {"count": 0, "is_added": 0, "is_subscribed": 0} for wid in ids
        }
        for row in library_rows:
            library_map[row["work_id"]] = row

        return [
            {
                "work": w,
                "genres": genres_map[w["id"]],
                "latest": latest_map[w["id"]],
                "next": next_map[w["id"]],
                "first": first_map[w["id"]],
                "library": library_map[w["id"]],
            }
            for w in works
        ]

    async def enrich_work(
        self, work: Dict[str, Any], user_id: Optional[int]
    ) -> Dict[str, Any]:
        """Mantiene compatibilidad; internamente usa el batch loader."""
        results = await self.enrich_works_batch([work], user_id)
        return results[0]

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
