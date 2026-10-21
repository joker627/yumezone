import json
from typing import Any, Dict, List, Optional
import aiomysql


class NotificationRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def list_for_user(
        self, user_id: int, unread_only: bool = False, limit: int = 30
    ) -> Dict[str, Any]:
        where = "AND read_at IS NULL" if unread_only else ""
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                f"""
                SELECT id, type, payload, read_at, created_at
                FROM notifications
                WHERE user_id = %s {where}
                ORDER BY created_at DESC LIMIT %s
                """,
                (user_id, limit),
            )
            rows = await cur.fetchall() or []
            for r in rows:
                if isinstance(r.get("payload"), str):
                    try:
                        r["payload"] = json.loads(r["payload"])
                    except Exception:
                        pass

            await cur.execute(
                "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND read_at IS NULL",
                (user_id,),
            )
            count_row = await cur.fetchone()
            unread_count = count_row["count"] if count_row else 0
            return {"data": rows, "unread_count": unread_count}

    async def mark_read(self, notification_id: int, user_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = %s AND user_id = %s",
                (notification_id, user_id),
            )
            await self.conn.commit()
            return cur.rowcount > 0

    async def mark_all_read(self, user_id: int) -> int:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = %s AND read_at IS NULL",
                (user_id,),
            )
            await self.conn.commit()
            return cur.rowcount

    async def delete_notification(self, notification_id: int, user_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM notifications WHERE id = %s AND user_id = %s",
                (notification_id, user_id),
            )
            await self.conn.commit()
            return cur.rowcount > 0

    async def clear_notifications(self, user_id: int) -> int:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM notifications WHERE user_id = %s",
                (user_id,),
            )
            await self.conn.commit()
            return cur.rowcount

    async def create_notification(self, user_id: int, notif_type: str, payload: Any) -> int:
        payload_str = json.dumps(payload) if not isinstance(payload, str) else payload
        async with self.conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO notifications (user_id, type, payload) VALUES (%s, %s, %s)",
                (user_id, notif_type, payload_str),
            )
            await self.conn.commit()
            return cur.lastrowid
