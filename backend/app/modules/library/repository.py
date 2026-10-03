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
