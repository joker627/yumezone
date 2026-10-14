from typing import Any, Dict, List, Optional
import aiomysql


class ChatRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def list_messages(self, channel: str = "general", limit: int = 30) -> List[Dict[str, Any]]:
        norm_channel = (channel or "general").strip().lower()
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT hc.id, hc.content, hc.channel, hc.is_pinned, hc.created_at,
                       u.id AS user_id, u.username, u.avatar_url, u.anillo_url, u.anillo_url AS avatar_frame_url, u.platform_role, u.xp
                FROM home_chats hc 
                JOIN users u ON u.id = hc.user_id
                WHERE hc.channel = %s OR (%s = 'general' AND (hc.channel IS NULL OR hc.channel = '' OR hc.channel = 'general'))
                ORDER BY hc.is_pinned DESC, hc.created_at DESC 
                LIMIT %s
                """,
                (norm_channel, norm_channel, limit),
            )
            return await cur.fetchall() or []

    async def create_message(self, user_id: int, content: str, channel: str = "general") -> int:
        async with self.conn.cursor() as cur:
            try:
                await cur.execute(
                    "INSERT INTO home_chats (user_id, content, channel) VALUES (%s, %s, %s)",
                    (user_id, content, channel),
                )
            except Exception:
                await cur.execute(
                    "INSERT INTO home_chats (user_id, content) VALUES (%s, %s)",
                    (user_id, content),
                )
            return cur.lastrowid

    async def get_message(self, message_id: int) -> Optional[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, user_id, content, channel, is_pinned, created_at FROM home_chats WHERE id = %s",
                (message_id,),
            )
            return await cur.fetchone()

    async def toggle_pin(self, message_id: int, is_pinned: bool) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "UPDATE home_chats SET is_pinned = %s WHERE id = %s",
                (is_pinned, message_id),
            )
            return cur.rowcount > 0

    async def delete_message(self, message_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute("DELETE FROM home_chats WHERE id = %s", (message_id,))
            return cur.rowcount > 0

    async def is_scan_leader(self, user_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "SELECT 1 FROM scan_group_members WHERE user_id = %s AND UPPER(role) IN ('ADMIN', 'MODERATOR', 'LEADER', 'OWNER') LIMIT 1",
                (user_id,)
            )
            return bool(await cur.fetchone())

    async def get_staff_user_ids(self, exclude_user_id: int) -> List[int]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id FROM users WHERE platform_role IN ('ADMIN', 'SUPERADMIN') AND id != %s",
                (exclude_user_id,)
            )
            rows = await cur.fetchall() or []
            return [r["id"] for r in rows]

    async def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(%s) LIMIT 1",
                (username,)
            )
            return await cur.fetchone()
