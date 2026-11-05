import os
from typing import Optional

import aiomysql
from fastapi import APIRouter, Depends, Request, Response, status

from app.core.database import get_db_connection
from app.core.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    invalidate_user_session,
)
from app.core.redis import enforce_rate_limit
from app.utils import get_client_ip
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
from app.modules.users.services import calculate_level_info

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# servicio de autenticacion con conexion inyectada
def get_auth_service(conn: aiomysql.Connection = Depends(get_db_connection)) -> AuthService:
    return AuthService(AuthRepository(conn))


@router.post(
    "/register",
    response_model=UserBase,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    user_data: UserCreate,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
):
    await enforce_rate_limit(f"register:{get_client_ip(request)}", max_requests=5, window_seconds=3600)
    created_user = await auth_service.register(user_data)
    lvl = calculate_level_info(created_user.xp)
    created_user.level_info = lvl
    created_user.level = lvl.level
    created_user.level_title = lvl.current_title
    created_user.level_progress_pct = lvl.percentage
    created_user.remaining_xp = lvl.remaining_xp
    return created_user


@router.post(
    "/login",
    response_model=Token,
    status_code=status.HTTP_200_OK,
)
async def login_user(
    user_credentials: UserLogin,
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    await enforce_rate_limit(f"login:{get_client_ip(request)}", max_requests=5, window_seconds=60)
    access_token = await auth_service.login(user_credentials)
    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=cookie_secure,
        max_age=3600 * 24 * 7,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_user(
    response: Response,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    if current_user and current_user.email:
        await invalidate_user_session(current_user.email)

    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=cookie_secure,
    )
    return {"message": "Sesión cerrada exitosamente"}


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

    lvl = calculate_level_info(current_user.xp)
    current_user.level_info = lvl
    current_user.level = lvl.level
    current_user.level_title = lvl.current_title
    current_user.level_progress_pct = lvl.percentage
    current_user.remaining_xp = lvl.remaining_xp
    return current_user


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
    await invalidate_user_session(current_user.email)
    lvl = calculate_level_info(updated_user.xp)
    updated_user.level_info = lvl
    updated_user.level = lvl.level
    updated_user.level_title = lvl.current_title
    updated_user.level_progress_pct = lvl.percentage
    updated_user.remaining_xp = lvl.remaining_xp
    return updated_user
