import json
from typing import Any, Dict, Optional

import aiomysql

from app.core.database import get_db_pool
from app.modules.users.models import CurrentUser, User


class AuthRepository:
    """Repositorio de usuarios.

    Abre su propia conexión porque se usa tanto desde dependencias de FastAPI
    (donde no hay conexión inyectada) como desde servicios con conexión propia.
    """

    async def _get_user_by_field(self, field: str, value) -> Optional[User]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    f"SELECT * FROM users WHERE {field} = %s",
                    (value,),
                )
                row = await cur.fetchone()
                return User(**row) if row else None

    async def get_user(self, username: str) -> Optional[User]:
        return await self._get_user_by_field("username", username)

    async def get_user_by_email(self, email: str) -> Optional[User]:
        return await self._get_user_by_field("email", email)

    async def is_scan_leader(self, user_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT 1 FROM scan_group_members WHERE user_id = %s AND UPPER(role) IN ('ADMIN', 'MODERATOR', 'LEADER', 'OWNER') LIMIT 1",
                    (user_id,)
                )
                return bool(await cur.fetchone())

    async def create_user(self, user: User) -> User:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO users
                        (user_code, username, email, password,
                         avatar_url, bio, is_private, platform_role, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user.user_code,
                        user.username,
                        user.email,
                        user.password,
                        user.avatar_url,
                        user.bio,
                        user.is_private,
                        user.platform_role,
                        user.status,
                    ),
                )
                await conn.commit()
        return user

    async def update_password(self, user: User) -> User:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE users SET password = %s WHERE id = %s",
                    (user.password, user.id),
                )
                await conn.commit()
        return user

    async def update_user(self, user: CurrentUser) -> CurrentUser:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE users
                    SET username = %s, bio = %s, avatar_url = %s, is_private = %s
                    WHERE id = %s
                    """,
                    (
                        user.username,
                        user.bio,
                        user.avatar_url,
                        user.is_private,
                        user.id,
                    ),
                )
                await conn.commit()
        return user

    async def delete_user(self, user_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
                await conn.commit()
        return True

    async def update_streak(self, user_id: int) -> Dict[str, Any]:
        """Valida y actualiza la racha diaria del usuario al iniciar sesión o consultar perfil.
        - Mismo día: no altera la racha ni duplica.
        - Día consecutivo siguiente (diff_days == 1): streak += 1 (racha aumentada).
        - Más de 1 día (diff_days > 1): streak = 1 (racha perdida si previous_streak > 1).
        - Primera vez (last_streak_date is None): streak = 1 (racha iniciada).
        """
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT streak_days, last_streak_date, CURDATE() AS today,
                           DATEDIFF(CURDATE(), last_streak_date) AS diff_days
                    FROM users
                    WHERE id = %s
                    """,
                    (user_id,),
                )
                row = await cur.fetchone()
                if not row:
                    return {
                        "streak_days": 0,
                        "last_streak_date": None,
                        "event": None,
                        "message": None,
                        "previous_streak": 0,
                    }

                streak = int(row.get("streak_days") or 0)
                previous_streak = streak
                last_date = row.get("last_streak_date")
                diff_days = row.get("diff_days")
                today = row["today"]

                event = None
                message = None
                notification_payload = None

                if last_date is None:
                    streak = 1
                    event = "started"
                    message = "¡Comenzaste tu racha diaria! Día 1 completado 🔥"
                    notification_payload = json.dumps({
                        "title": "¡Racha iniciada! 🔥",
                        "message": "Has comenzado tu racha de lectura. ¡Inicia sesión cada día para aumentarla!",
                        "url": "/pages/usuario.html"
                    })
                elif diff_days == 0:
                    event = "same_day"
                    message = f"¡Tu racha de {streak} días ya está asegurada por hoy! 🔥"
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
                    message = f"¡Racha aumentada! Llevas {streak} días consecutivos de lectura 🔥"
                    notification_payload = json.dumps({
                        "title": "¡Racha aumentada! 🔥",
                        "message": f"¡Increíble constancia! Has alcanzado {streak} días consecutivos de lectura.",
                        "url": "/pages/usuario.html"
                    })
                else:
                    streak = 1
                    if previous_streak > 1:
                        event = "lost"
                        message = f"¡Has perdido tu racha de {previous_streak} días! Tu racha se ha reiniciado a 1 día 💔"
                        notification_payload = json.dumps({
                            "title": "¡Racha perdida! 💔",
                            "message": f"No iniciaste sesión ayer y perdiste tu racha de {previous_streak} días. ¡No te rindas y empieza de nuevo hoy!",
                            "url": "/pages/usuario.html"
                        })
                    else:
                        event = "started"
                        message = "¡Racha diaria activada! Día 1 completado 🔥"
                        notification_payload = json.dumps({
                            "title": "¡Racha diaria activada! 🔥",
                            "message": "Has validado tu racha diaria de lectura. ¡Vuelve mañana para continuarla!",
                            "url": "/pages/usuario.html"
                        })

                await cur.execute(
                    "UPDATE users SET streak_days = %s, last_streak_date = %s WHERE id = %s",
                    (streak, today, user_id),
                )
                if notification_payload:
                    try:
                        await cur.execute(
                            """
                            INSERT INTO notifications (user_id, type, payload)
                            VALUES (%s, 'streak', %s)
                            """,
                            (user_id, notification_payload),
                        )
                    except Exception as err:
                        print(f"Error insertando notificación de racha: {err}")

                await conn.commit()
                return {
                    "streak_days": streak,
                    "last_streak_date": today,
                    "event": event,
                    "message": message,
                    "previous_streak": previous_streak,
                }
