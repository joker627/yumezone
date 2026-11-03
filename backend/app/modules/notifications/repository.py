from typing import Any, Dict, Optional
import aiomysql

from app.core.database import resolve_connection
from app.utils import parse_json_safe, to_json_safe
from app.utils.formatters import format_relative_time


class NotificationRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    async def list_for_user(
        self, user_id: int, unread_only: bool = False, limit: int = 30
    ) -> Dict[str, Any]:
        where = "AND read_at IS NULL" if unread_only else ""
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
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
                enriched = []
                for r in rows:
                    payload = parse_json_safe(r.get("payload"), default={})
                    if not isinstance(payload, dict):
                        payload = {"title": str(payload)}

                    title = payload.get("title") or payload.get("message") or payload.get("text") or "Notificación"
                    desc = payload.get("body") or payload.get("description") or ""
                    if not desc and payload.get("title") and payload.get("message") and payload.get("title") != payload.get("message"):
                        desc = payload.get("message")

                    target_url = payload.get("url") or payload.get("link")
                    if not target_url and payload.get("work_slug"):
                        target_url = f"/pages/obra.html?slug={payload['work_slug']}"
                    elif not target_url and payload.get("chapter_id"):
                        target_url = f"/pages/leer.html?capitulo={payload['chapter_id']}"

                    ntype = str(r.get("type") or "system").lower()
                    if any(k in ntype for k in ("chapter", "manga", "obra")):
                        icon_type = "chapter"
                    elif any(k in ntype for k in ("reward", "translation", "coin")):
                        icon_type = "reward"
                    elif "level" in ntype:
                        icon_type = "level"
                    elif "streak" in ntype:
                        icon_type = "streak"
                    elif any(k in ntype for k in ("comment", "reply", "chat", "mention")):
                        icon_type = "comment"
                    else:
                        icon_type = "system"

                    r["payload"] = payload
                    r["title"] = title
                    r["description"] = desc
                    r["target_url"] = target_url
                    r["icon_type"] = icon_type
                    r["time_ago"] = format_relative_time(r.get("created_at"))
                    enriched.append(r)

                await cur.execute(
                    "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND read_at IS NULL",
                    (user_id,),
                )
                count_row = await cur.fetchone()
                unread_count = count_row["count"] if count_row else 0
                return {"data": enriched, "unread_count": unread_count}

    async def mark_read(self, notification_id: int, user_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = %s AND user_id = %s",
                    (notification_id, user_id),
                )
                if self.conn is None:
                    await conn.commit()
                return cur.rowcount > 0

    async def mark_all_read(self, user_id: int) -> int:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = %s AND read_at IS NULL",
                    (user_id,),
                )
                if self.conn is None:
                    await conn.commit()
                return cur.rowcount

    async def delete_notification(self, notification_id: int, user_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM notifications WHERE id = %s AND user_id = %s",
                    (notification_id, user_id),
                )
                if self.conn is None:
                    await conn.commit()
                return cur.rowcount > 0

    async def clear_notifications(self, user_id: int) -> int:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM notifications WHERE user_id = %s",
                    (user_id,),
                )
                if self.conn is None:
                    await conn.commit()
                return cur.rowcount

    async def create_notification(self, user_id: int, notif_type: str, payload: Any) -> int:
        payload_str = to_json_safe(payload)
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "INSERT INTO notifications (user_id, type, payload) VALUES (%s, %s, %s)",
                    (user_id, notif_type, payload_str),
                )
                if self.conn is None:
                    await conn.commit()
                return cur.lastrowid
