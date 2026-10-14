# imports external
from fastapi import APIRouter, Depends, status

# imports internal
from app.core.dependencies import get_current_active_user
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    Token,
    UserBase,
    UserCreate,
    UserLogin,
    UserUpdate,
)
from app.modules.auth.services import AuthService
from app.modules.users.models import CurrentUser

router = APIRouter()


# dependencias del endpoint router
def get_auth_service():
    repository = AuthRepository()
    return AuthService(repository)


# endpoint registrar usuario
@router.post(
    "/register",
    response_model=UserBase,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    user_data: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
):
    new_user = await auth_service.register(user_data)
    return new_user


import os
from fastapi import APIRouter, Depends, status, Response

# endpoint iniciar sesión
@router.post(
    "/login",
    response_model=Token,
    status_code=status.HTTP_200_OK,
)
async def login_user(
    user_credentials: UserLogin,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    access_token = await auth_service.login(user_credentials)
    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    
    # Configurar cookie HttpOnly
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=cookie_secure,
        max_age=3600 * 24 * 7 # 7 días
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# endpoint cerrar sesión
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_user(response: Response):
    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=cookie_secure
    )
    return {"message": "Sesión cerrada exitosamente"}


# endpoint obtener usuario actual
@router.get(
    "/me",
    response_model=UserBase,
    status_code=status.HTTP_200_OK,
)
async def get_me(
    current_user: CurrentUser = Depends(get_current_active_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    streak_info = await auth_service.repository.update_streak(current_user.id)
    current_user.streak_days = streak_info.get("streak_days", current_user.streak_days)
    current_user.last_streak_date = streak_info.get("last_streak_date", current_user.last_streak_date)
    current_user.streak_event = streak_info.get("event")
    current_user.streak_message = streak_info.get("message")
    current_user.previous_streak = streak_info.get("previous_streak")
    return current_user


# actualizar datos del usuario
@router.patch(
    "/me",
    response_model=UserBase,
    status_code=status.HTTP_200_OK,
)
async def update_me(
    update_data: UserUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    updated_user = await auth_service.update_profile(current_user, update_data)
    return updated_user
