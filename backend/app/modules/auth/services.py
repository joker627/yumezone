# imports standard
import random
import secrets
import string
from datetime import timedelta

# imports external
from fastapi import HTTPException, status

# imports internal
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.core.settings.config import get_settings
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import UserCreate, UserLogin, UserUpdate
from app.modules.users.models import CurrentUser, User

settings = get_settings()


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    # Registrar nuevo usuario
    async def register(self, user_data: UserCreate) -> User:
        # Si no envía un username, generamos uno aleatorio
        if not user_data.username:
            # Un sufijo aleatorio no sustituye la restricción UNIQUE de la BD,
            # pero evita rechazos innecesarios durante el registro automático.
            for _ in range(10):
                username = f"Lector_{''.join(random.choices(string.digits, k=5))}"
                if not await self.repository.get_user(username):
                    break
            else:
                raise HTTPException(status_code=503, detail="No se pudo asignar un nombre de usuario")
        else:
            username = user_data.username.strip()

        email = str(user_data.email).strip().lower()
        if await self.repository.get_user_by_email(email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una cuenta con ese correo electrónico.",
            )
        if await self.repository.get_user(username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ese nombre de usuario ya está en uso.",
            )

        hashed_password = hash_password(user_data.password)

        user_code = secrets.token_hex(8).upper()
        db_user = User(
            user_code=user_code,
            username=username,
            email=email,
            password=hashed_password,
        )
        created_user = await self.repository.create_user(db_user)
        return created_user

    # Iniciar sesión
    async def login(self, user_credentials: UserLogin) -> str:
        # Solo permitir login por correo electrónico
        user = await self.repository.get_user_by_email(user_credentials.email)

        if (
            not user
            or not user.password
            or not verify_password(user_credentials.password, user.password)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Correo o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if user.status.upper() != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta cuenta no está activa",
            )
        # Validar racha diaria por inicio de sesión
        await self.repository.update_streak(user.id)

        access_token_expires = timedelta(minutes=settings.jwt_exp)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        return access_token

    # Actualizar perfil del usuario
    async def update_profile(
        self,
        current_user: CurrentUser,
        update_data: UserUpdate,
    ) -> CurrentUser:
        # Copiamos los datos actuales para no borrar lo que
        # el usuario no quiere cambiar
        if update_data.username is not None:
            username = update_data.username.strip()
            existing_user = await self.repository.get_user(username)
            if existing_user and existing_user.id != current_user.id:
                raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso")
            current_user.username = username
        if update_data.avatar_url is not None:
            current_user.avatar_url = update_data.avatar_url
        if update_data.bio is not None:
            current_user.bio = update_data.bio
        if update_data.is_private is not None:
            current_user.is_private = update_data.is_private
        await self.repository.update_user(current_user)
        return current_user
