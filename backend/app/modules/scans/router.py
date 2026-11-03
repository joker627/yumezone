from typing import List, Optional
import aiomysql
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_db_connection
from app.core.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    is_platform_admin,
)
from app.modules.scans.schemas import (

    ScanGroupCreate,
    ScanGroupMemberResponse,
    ScanGroupResponse,
    ScanGroupUpdate,
    UpdateMemberPermissions,
)
from app.modules.scans.services import ScanGroupService
from app.modules.users.models import CurrentUser

router = APIRouter(prefix="/scan-groups", tags=["Scanlators"])


def get_scan_group_service(conn: aiomysql.Connection = Depends(get_db_connection)):
    return ScanGroupService(conn)


@router.get("/roles", response_model=List[dict])
async def list_scan_roles(
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Lista los roles y funciones reales de scan definidos en la BD."""
    return await service.get_all_roles()


@router.get("/public", response_model=List[dict])
async def list_public_scans(
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Lista todos los clanes/scans publicos activos con estadisticas agregadas."""
    return await service.get_public_scans()


@router.get("/my-scan")
async def get_my_scan(
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Obtiene el clan al que pertenece el usuario autenticado (si aplica)."""
    if not current_user:
        return None
    return await service.get_user_scan(current_user.id)


@router.get("/public/{slug}")
async def get_public_scan_detail(
    slug: str,
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Obtiene el perfil publico de un clan con sus obras traducidas y miembros."""
    return await service.get_public_scan_detail(slug)


async def get_current_group_manager(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
) -> CurrentUser:
    if is_platform_admin(current_user):
        return current_user
    member = await service.repository.get_member(group_id, current_user.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No perteneces a este grupo.")
    if not member.can_manage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administración en este grupo.",
        )
    return current_user


# Editar o borrar el grupo es exclusivo del líder (o de un admin de plataforma)
async def require_group_leader(
    group_id: int,
    current_user: CurrentUser,
    service: ScanGroupService,
) -> None:
    if is_platform_admin(current_user):
        return
    member = await service.repository.get_member(group_id, current_user.id)
    if not member or not member.is_leader:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el líder del grupo puede realizar esta acción.",
        )



@router.post("/", response_model=ScanGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: ScanGroupCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.create_group(current_user, group_data)


@router.put("/{group_id}", response_model=ScanGroupResponse)
async def update_group(
    group_id: int,
    group_data: ScanGroupUpdate,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    await require_group_leader(group_id, current_user, service)
    return await service.update_group(group_id, group_data.model_dump(exclude_unset=True))


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    await require_group_leader(group_id, current_user, service)
    await service.delete_group(group_id)


@router.get("/{group_id}/members", response_model=List[ScanGroupMemberResponse])
async def get_group_members(
    group_id: int,
    _: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.get_group_members(group_id)


@router.put("/{group_id}/members/{user_id}")
async def update_member_permissions(
    group_id: int,
    user_id: int,
    updates: UpdateMemberPermissions,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.update_member_permissions(group_id, current_user, user_id, updates)


@router.delete("/{group_id}/members/{user_id}")
async def kick_member(
    group_id: int,
    user_id: int,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.kick_member(group_id, current_user, user_id)
