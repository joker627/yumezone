from datetime import date
from typing import Any, Dict, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.notifications.models import NotificationORM
from app.modules.scans.models import ScanGroupMemberORM
from app.modules.users.models import UserORM
from app.modules.users.schemas import CurrentUser, User

_LOOKUP_FIELDS = {"username", "email"}


class AuthRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def _get_user_by_field(self, field: str, value: Any) -> Optional[User]:
        if field not in _LOOKUP_FIELDS:
            raise ValueError(f"Campo de búsqueda no permitido: {field}")
        col = UserORM.username if field == "username" else UserORM.email
        async with resolve_session(self.conn) as session:
            res = await session.execute(select(UserORM).where(col == value))
            user_obj = res.scalar_one_or_none()
            return User(**user_obj.to_dict()) if user_obj else None

    async def get_user(self, username: str) -> Optional[User]:
        return await self._get_user_by_field("username", username)

    async def get_user_by_email(self, email: str) -> Optional[User]:
        return await self._get_user_by_field("email", email)

    async def is_scan_member(self, user_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ScanGroupMemberORM.group_id)
                .where(ScanGroupMemberORM.user_id == user_id)
                .limit(1)
            )
            return res.scalar_one_or_none() is not None

    async def create_user(self, user: User) -> User:
        async with resolve_session(self.conn) as session:
            new_user = UserORM(
                user_code=user.user_code,
                username=user.username,
                email=user.email,
                password=user.password,
                avatar_url=user.avatar_url,
                bio=user.bio,
                is_private=user.is_private,
                platform_role=user.platform_role,
                status=user.status,
            )
            session.add(new_user)
            if self.conn is None:
                await session.commit()
            else:
                await session.flush()
            user.id = new_user.id
        return user

    async def update_password(self, user: User) -> User:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(UserORM)
                .where(UserORM.id == user.id)
                .values(password=user.password)
            )
            if self.conn is None:
                await session.commit()
        return user

    async def update_user(self, user: CurrentUser) -> CurrentUser:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(UserORM)
                .where(UserORM.id == user.id)
                .values(
                    username=user.username,
                    bio=user.bio,
                    avatar_url=user.avatar_url,
                    is_private=user.is_private,
                )
            )
            if self.conn is None:
                await session.commit()
        return user

    async def update_streak(self, user_id: int) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            user_obj = await session.get(UserORM, user_id)
            if not user_obj:
                return {
                    "streak_days": 0,
                    "last_streak_date": None,
                    "event": None,
                    "message": None,
                    "previous_streak": 0,
                }

            streak = int(user_obj.streak_days or 0)
            previous_streak = streak
            last_date = user_obj.last_streak_date
            today = date.today()
            diff_days = (today - last_date).days if last_date is not None else None

            event = None
            message = None
            notification_payload = None

            if last_date is None:
                streak = 1
                event = "started"
                message = "¡Comenzaste tu racha diaria! Día 1 completado "
                notification_payload = {
                    "title": "¡Racha iniciada! ",
                    "message": "Has comenzado tu racha de lectura. ¡Inicia sesión cada día para aumentarla!",
                    "url": "/pages/usuario.html",
                }
            elif diff_days == 0:
                event = "same_day"
                message = f"¡Tu racha de {streak} días ya está asegurada por hoy! "
                return {
                    "streak_days": streak,
                    "last_streak_date": last_date,
                    "event": event,
                    "message": message,
                    "previous_streak": previous_streak,
                }
            elif diff_days == 1:
                streak += 1
                event = "increased"
                message = f"¡Racha aumentada! Llevas {streak} días consecutivos de lectura "
                notification_payload = {
                    "title": "¡Racha aumentada! ",
                    "message": f"¡Increíble constancia! Has alcanzado {streak} días consecutivos de lectura.",
                    "url": "/pages/usuario.html",
                }
            else:
                streak = 1
                if previous_streak > 1:
                    event = "lost"
                    message = f"¡Has perdido tu racha de {previous_streak} días! Tu racha se ha reiniciado a 1 día "
                    notification_payload = {
                        "title": "¡Racha perdida! ",
                        "message": f"No iniciaste sesión ayer y perdiste tu racha de {previous_streak} días. ¡No te rindas y empieza de nuevo hoy!",
                        "url": "/pages/usuario.html",
                    }
                else:
                    event = "started"
                    message = "¡Racha diaria activada! Día 1 completado "
                    notification_payload = {
                        "title": "¡Racha diaria activada! ",
                        "message": "Has validado tu racha diaria de lectura. ¡Vuelve mañana para continuarla!",
                        "url": "/pages/usuario.html",
                    }

            user_obj.streak_days = streak
            user_obj.last_streak_date = today

            if notification_payload:
                session.add(
                    NotificationORM(
                        user_id=user_id,
                        type="streak",
                        payload=notification_payload,
                    )
                )

            if self.conn is None:
                await session.commit()
            else:
                await session.flush()

            return {
                "streak_days": streak,
                "last_streak_date": today,
                "event": event,
                "message": message,
                "previous_streak": previous_streak,
            }
