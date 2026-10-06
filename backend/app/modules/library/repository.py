from typing import Optional

import aiomysql


class LibraryRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def get_notification_preference(
        self, user_id: int, work_id: int
    ) -> Optional[bool]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT notify_new_chapters
                FROM user_library
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            row = await cur.fetchone()
            return bool(row["notify_new_chapters"]) if row else None

    async def list_for_user(
        self, user_id: int, work_id: Optional[int] = None
    ) -> list[dict]:
        work_filter = " AND w.id = %s" if work_id is not None else ""
        values = (user_id, work_id) if work_id is not None else (user_id,)
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                f"""
                SELECT w.id, w.title, w.slug, w.alternative_title, w.synopsis,
                       w.author, w.cover_url, w.banner_url, w.status_id,
                       w.format_id, w.demographic_id, w.scan_group_id,
                       COALESCE(ws.total_views, 0) AS total_views,
                       COALESCE(ws.rating_average, 0) AS rating_average,
                       COALESCE(ws.rating_count, 0) AS rating_count,
                       COALESCE(ws.followers_count, 0) AS followers_count,
                       COALESCE(ws.favorites_count, 0) AS favorites_count,
                       COALESCE(ws.trending_score, 0) AS trending_score,
                       (SELECT c.id FROM chapters AS c
                        WHERE c.work_id = w.id AND c.status = 'PUBLISHED'
                        ORDER BY c.chapter_number ASC, c.published_at ASC
                        LIMIT 1) AS first_chapter_id,
                       COALESCE(ul.status, 'FOLLOWING') AS library_status,
                       ul.rating,
                       COALESCE(ul.notify_new_chapters, TRUE) AS notify_new_chapters,
                       ul.added_at
                FROM user_library AS ul
                JOIN works AS w ON w.id = ul.work_id
                LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                WHERE ul.user_id = %s
                {work_filter}
                ORDER BY ul.added_at DESC, w.title ASC
                """,
                values,
            )
            return await cur.fetchall()

    async def get_for_user(self, user_id: int, work_id: int) -> Optional[dict]:
        items = await self.list_for_user(user_id, work_id)
        return items[0] if items else None

    async def work_exists(self, work_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute("SELECT 1 FROM works WHERE id = %s", (work_id,))
            return await cur.fetchone() is not None

    async def add_work(self, user_id: int, work_id: int, status: str) -> None:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT IGNORE INTO user_library (user_id, work_id, status)
                VALUES (%s, %s, %s)
                """,
                (user_id, work_id, status),
            )
            await self.conn.commit()

    async def update_status(self, user_id: int, work_id: int, status: str) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE user_library
                SET status = %s
                WHERE user_id = %s AND work_id = %s
                """,
                (status, user_id, work_id),
            )
            await self.conn.commit()
            await cur.execute(
                "SELECT 1 FROM user_library WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            return await cur.fetchone() is not None

    async def remove_work(self, user_id: int, work_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM user_library WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            await self.conn.commit()
            return cur.rowcount > 0

    async def update_notification_preference(
        self, user_id: int, work_id: int, notify_new_chapters: bool
    ) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE user_library
                SET notify_new_chapters = %s
                WHERE user_id = %s AND work_id = %s
                """,
                (notify_new_chapters, user_id, work_id),
            )
            await self.conn.commit()
            await cur.execute(
                """
                SELECT 1
                FROM user_library
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            return await cur.fetchone() is not None
