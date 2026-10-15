from typing import Any, Dict, List, Optional
import aiomysql


class ChatRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def list_messages(self, limit: int = 30) -> List[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT hc.id, hc.content, hc.created_at,
                       u.id AS user_id, u.username, u.avatar_url, u.anillo_url, u.anillo_url AS avatar_frame_url, u.platform_role, u.xp
                FROM home_chats hc 
                JOIN users u ON u.id = hc.user_id
                ORDER BY hc.created_at DESC 
                LIMIT %s
                """,
                (limit,),
            )
            return await cur.fetchall() or []

    async def create_message(self, user_id: int, content: str) -> int:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO home_chats (user_id, content) VALUES (%s, %s)",
                (user_id, content),
            )
            return cur.lastrowid

    async def get_message(self, message_id: int) -> Optional[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, user_id, content, created_at FROM home_chats WHERE id = %s",
                (message_id,),
            )
            return await cur.fetchone()

    async def delete_message(self, message_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute("DELETE FROM home_chats WHERE id = %s", (message_id,))
            return cur.rowcount > 0
