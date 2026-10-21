from typing import Any, Dict, List, Optional
import aiomysql


class ChatRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def list_messages(self, limit: int = 40, current_user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT hc.id, hc.content, hc.created_at,
                       u.id AS user_id, u.username, u.avatar_url,
                       u.anillo_url, u.platform_role, u.xp
                FROM chats AS hc
                JOIN users AS u ON u.id = hc.user_id
                WHERE hc.created_at >= (CURRENT_TIMESTAMP - INTERVAL 24 HOUR)
                ORDER BY hc.created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            messages = await cur.fetchall() or []
            if not messages:
                return []

            msg_ids = [m["id"] for m in messages]
            ph = ", ".join("%s" for _ in msg_ids)
            params = [current_user_id or 0] + msg_ids

            await cur.execute(
                f"""
                SELECT message_id, reaction, COUNT(*) AS count,
                       MAX(CASE WHEN user_id = %s THEN 1 ELSE 0 END) AS user_reacted
                FROM chat_reactions
                WHERE message_id IN ({ph})
                GROUP BY message_id, reaction
                ORDER BY count DESC
                """,
                tuple(params),
            )
            reaction_rows = await cur.fetchall() or []
            reactions_map: Dict[int, List[Dict[str, Any]]] = {}
            for r in reaction_rows:
                mid = int(r["message_id"])
                reactions_map.setdefault(mid, []).append({
                    "reaction": r["reaction"],
                    "count": int(r["count"]),
                    "user_reacted": bool(r["user_reacted"]),
                })

            for m in messages:
                m["reactions"] = reactions_map.get(m["id"], [])

            return messages

    async def toggle_reaction(self, message_id: int, user_id: int, reaction: str) -> Dict[str, Any]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            # Verificar si el mensaje existe
            await cur.execute("SELECT id FROM chats WHERE id = %s", (message_id,))
            if not await cur.fetchone():
                raise ValueError("Mensaje no encontrado")

            # Verificar si ya reaccionó con ese emoji
            await cur.execute(
                "SELECT 1 FROM chat_reactions WHERE message_id = %s AND user_id = %s AND reaction = %s",
                (message_id, user_id, reaction),
            )
            existing = await cur.fetchone()

            if existing:
                await cur.execute(
                    "DELETE FROM chat_reactions WHERE message_id = %s AND user_id = %s AND reaction = %s",
                    (message_id, user_id, reaction),
                )
                action = "removed"
            else:
                await cur.execute(
                    """
                    INSERT INTO chat_reactions (message_id, user_id, reaction)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP
                    """,
                    (message_id, user_id, reaction),
                )
                action = "added"

            await self.conn.commit()

            # Obtener reacciones consolidadas para el mensaje
            await cur.execute(
                """
                SELECT reaction, COUNT(*) AS count,
                       MAX(CASE WHEN user_id = %s THEN 1 ELSE 0 END) AS user_reacted
                FROM chat_reactions
                WHERE message_id = %s
                GROUP BY reaction
                ORDER BY count DESC
                """,
                (user_id, message_id),
            )
            rows = await cur.fetchall() or []
            reactions = [
                {
                    "reaction": r["reaction"],
                    "count": int(r["count"]),
                    "user_reacted": bool(r["user_reacted"]),
                }
                for r in rows
            ]

            return {
                "message_id": message_id,
                "action": action,
                "reactions": reactions,
            }

    async def create_message(self, user_id: int, content: str) -> int:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO chats (user_id, content) VALUES (%s, %s)",
                (user_id, content),
            )
            last_id = cur.lastrowid

            # Purga oportunista de mensajes con más de 24 horas
            await cur.execute(
                "DELETE FROM chats WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL 24 HOUR)"
            )
            return last_id

    async def purge_expired_messages(self, hours: int = 24) -> int:
        """Elimina mensajes con más de 24 horas de antigüedad."""
        async with self.conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM chats WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL %s HOUR)",
                (hours,),
            )
            return cur.rowcount

