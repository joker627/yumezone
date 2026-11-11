import json
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.redis import get_redis_client
from app.core.security import decode_access_token
from app.modules.auth.repository import AuthRepository
from app.modules.scans.repository import ScanGroupRepository
from app.modules.users.schemas import CurrentUser

security = HTTPBearer(auto_error=False)

USER_SESSION_CACHE_TTL = 300
PLATFORM_ADMIN_ROLES = ("ADMIN", "SUPERADMIN")


def _session_key(email: str) -> str:
    return f"yume:user_session:{email}"


def is_platform_admin(user: CurrentUser) -> bool:
    return user.platform_role.upper() in PLATFORM_ADMIN_ROLES


async def invalidate_user_session(email: Optional[str]) -> None:
    redis = get_redis_client()
    if not redis or not email:
        return
    try:
        await redis.delete(_session_key(email))
    except Exception:
        pass


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    if credentials:
        return credentials.credentials
    return request.cookies.get("access_token")


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _extract_token(request, credentials)
    payload = decode_access_token(token) if token else None
    email = payload.get("sub") if payload else None
    if not email:
        raise credentials_exception

    redis = get_redis_client()
    cache_key = _session_key(email)
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return CurrentUser(**json.loads(cached))
        except Exception:
            pass

    repository = AuthRepository()
    user = await repository.get_user_by_email(email)
    if user is None or user.id is None:
        raise credentials_exception

    current_user = CurrentUser(
        **user.model_dump(),
        is_scan_member=await repository.is_scan_member(user.id),
    )

    if redis:
        try:
            await redis.set(
                cache_key,
                current_user.model_dump_json(),
                ex=USER_SESSION_CACHE_TTL,
            )
        except Exception:
            pass

    return current_user


async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[CurrentUser]:
    if not _extract_token(request, credentials):
        return None
    try:
        return await get_current_user(request, credentials)
    except Exception:
        return None


async def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if current_user.status.upper() != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo"
        )
    return current_user


async def get_current_admin_user(
    current_user: CurrentUser = Depends(get_current_active_user),
) -> CurrentUser:
    if not is_platform_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no tiene permisos suficientes",
        )
    return current_user


async def verify_upload_permission(
    user: CurrentUser,
    scan_group_id: Optional[int] = None,
    conn: Optional[AsyncSession] = None,
) -> bool:
    if is_platform_admin(user):
        return True
    if not scan_group_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes pertenecer a un grupo scan para subir contenido.",
        )

    scan_repo = ScanGroupRepository(conn)
    member = await scan_repo.get_member(scan_group_id, user.id)

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este grupo scan.",
        )

    if member.can_upload:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes permisos para subir contenido en este grupo.",
    )


async def verify_scan_member_permission(
    user: CurrentUser,
    scan_group_id: Optional[int] = None,
    conn: Optional[AsyncSession] = None,
) -> bool:
    if is_platform_admin(user):
        return True
    if not scan_group_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes pertenecer a un grupo scan para realizar esta acción.",
        )

    scan_repo = ScanGroupRepository(conn)
    member = await scan_repo.get_member(scan_group_id, user.id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este grupo scan.",
        )
    return True


async def verify_scan_manage_permission(
    user: CurrentUser,
    scan_group_id: Optional[int] = None,
    conn: Optional[AsyncSession] = None,
) -> bool:
    if is_platform_admin(user):
        return True
    if not scan_group_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes especificar el grupo scan responsable de la obra.",
        )

    scan_repo = ScanGroupRepository(conn)
    member = await scan_repo.get_member(scan_group_id, user.id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este grupo scan.",
        )

    if str(member.role or "").upper() == "LEADER" or member.can_upload:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes permisos de gestión o subida en este grupo scan.",
    )
