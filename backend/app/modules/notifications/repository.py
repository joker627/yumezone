from typing import Any, Dict, Optional
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.notifications.models import NotificationORM
from app.utils.formatters import parse_json_safe
from app.utils.formatters import format_relative_time


class NotificationRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def list_for_user(
        self, user_id: int, unread_only: bool = False, limit: int = 30
    ) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            stmt = select(
                NotificationORM.id,
                NotificationORM.type,
                NotificationORM.payload,
                NotificationORM.read_at,
                NotificationORM.created_at,
            ).where(NotificationORM.user_id == user_id)

            if unread_only:
                stmt = stmt.where(NotificationORM.read_at.is_(None))

            stmt = stmt.order_by(NotificationORM.created_at.desc()).limit(limit)
            res = await session.execute(stmt)
            rows = [dict(r) for r in res.mappings().all()]

            enriched = []
            for r in rows:
                raw_payload = r.get("payload")
                payload = (
                    raw_payload
                    if isinstance(raw_payload, dict)
                    else parse_json_safe(raw_payload, default={})
                )
                if not isinstance(payload, dict):
                    payload = {"title": str(payload)}

                title = (
                    payload.get("title")
                    or payload.get("message")
                    or payload.get("text")
                    or "Notificación"
                )
                desc = payload.get("body") or payload.get("description") or ""
                if (
                    not desc
                    and payload.get("title")
                    and payload.get("message")
                    and payload.get("title") != payload.get("message")
                ):
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

            count_res = await session.execute(
                select(func.count())
                .select_from(NotificationORM)
                .where(
                    NotificationORM.user_id == user_id,
                    NotificationORM.read_at.is_(None),
                )
            )
            unread_count = count_res.scalar() or 0
            return {"data": enriched, "unread_count": unread_count}

    async def mark_read(self, notification_id: int, user_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                update(NotificationORM)
                .where(
                    NotificationORM.id == notification_id,
                    NotificationORM.user_id == user_id,
                )
                .values(
                    read_at=func.coalesce(
                        NotificationORM.read_at, func.current_timestamp()
                    )
                )
            )
            if self.conn is None:
                await session.commit()
            return (res.rowcount or 0) > 0

    async def mark_all_read(self, user_id: int) -> int:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                update(NotificationORM)
                .where(
                    NotificationORM.user_id == user_id,
                    NotificationORM.read_at.is_(None),
                )
                .values(read_at=func.current_timestamp())
            )
            if self.conn is None:
                await session.commit()
            return res.rowcount or 0

    async def delete_notification(self, notification_id: int, user_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                delete(NotificationORM).where(
                    NotificationORM.id == notification_id,
                    NotificationORM.user_id == user_id,
                )
            )
            if self.conn is None:
                await session.commit()
            return (res.rowcount or 0) > 0

    async def clear_notifications(self, user_id: int) -> int:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                delete(NotificationORM).where(NotificationORM.user_id == user_id)
            )
            if self.conn is None:
                await session.commit()
            return res.rowcount or 0

    async def create_notification(
        self, user_id: int, notif_type: str, payload: Any
    ) -> int:
        parsed_payload = (
            payload
            if isinstance(payload, dict)
            else parse_json_safe(payload, default={"title": str(payload)})
        )
        async with resolve_session(self.conn) as session:
            notif = NotificationORM(
                user_id=user_id,
                type=notif_type,
                payload=parsed_payload,
            )
            session.add(notif)
            if self.conn is None:
                await session.commit()
            else:
                await session.flush()
            return notif.id
