from typing import Optional

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
