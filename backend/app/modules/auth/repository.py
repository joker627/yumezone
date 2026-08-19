from typing import Optional
import aiomysql
from app.modules.users.models import User
from app.core.database import get_db_pool

class AuthRepository:
    # Obtener usuario por nombre de usuario
    async def get_user(self, username: str) -> Optional[User]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM users WHERE username = %s", (username,))
                row = await cur.fetchone()
                if row:
                    return User(**row)
        return None

    # Obtener usuario por correo electrónico
    async def get_user_by_email(self, email: str) -> Optional[User]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM users WHERE email = %s", (email,))
                row = await cur.fetchone()
                if row:
                    return User(**row)
        return None

    # Crear usuario
    async def create_user(self, user: User) -> User:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO users (user_code, username, email, password, avatar_url, bio, is_private, platform_role, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = (
                    user.user_code, user.username, user.email, user.password, user.avatar_url, 
                    user.bio, user.is_private, user.platform_role, user.status
                )
                await cur.execute(query, values)
                await conn.commit()
                return user

    # Actualizar contraseña de usuario
    async def update_password(self, user: User) -> User:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = "UPDATE users SET password = %s WHERE id = %s"
                values = (
                    user.password, user.id
                )
                await cur.execute(query, values)
                await conn.commit()
        return user

    # Actualizar usuario
    async def update_user(self, user: User) -> User:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = "UPDATE users SET username = %s, bio = %s, avatar_url = %s, is_private = %s WHERE id = %s"
                values = (
                    user.username, user.bio, user.avatar_url, user.is_private, user.id
                )
                await cur.execute(query, values)
                await conn.commit()
        return user

    # Eliminar usuario
    async def delete_user(self, user_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
                await conn.commit()
        return True
