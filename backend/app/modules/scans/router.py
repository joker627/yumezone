from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_active_user
from app.modules.scans.schemas import (
    ScanGroupCreate,
    ScanGroupMemberResponse,
    ScanGroupResponse,
    ScanGroupUpdate,
    UpdateMemberPermissions,
)
from app.modules.scans.services import ScanGroupService
from app.modules.users.models import CurrentUser

router = APIRouter(tags=["Scan Groups"])


def get_scan_group_service():
    return ScanGroupService()


# Dependencia para verificar permisos de administrador de grupo
async def get_current_group_admin(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    member = await service.repository.get_member(group_id, current_user.id)
    if not member:
        # Fallback to Superadmin
        if current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]:
            return current_user
        raise HTTPException(
            status_code=403,
            detail="No perteneces a este grupo.",
        )
    if member.role not in ["ADMIN", "MODERATOR"]:
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos de administración en este grupo.",
        )
    return current_user


@router.post(
    "/",
    response_model=ScanGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
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
    current_user: CurrentUser = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    member = await service.repository.get_member(group_id, current_user.id)
    # Solo el ADMIN del grupo o un superadmin de la plataforma
    # puede editar el perfil del grupo
    is_admin = member and member.role == "ADMIN"
    is_platform_admin = current_user.platform_role.upper() in [
        "ADMIN",
        "SUPERADMIN",
    ]
    if not (is_admin or is_platform_admin):
        raise HTTPException(
            status_code=403,
            detail=("Solo el creador/ADMIN del grupo puede editar su perfil."),
        )

    return await service.update_group(
        group_id, group_data.model_dump(exclude_unset=True)
    )


@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_group(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    member = await service.repository.get_member(group_id, current_user.id)
    # Solo el ADMIN del grupo o un superadmin de la plataforma
    # puede borrar el grupo
    is_admin = member and member.role == "ADMIN"
    is_platform_admin = current_user.platform_role.upper() in [
        "ADMIN",
        "SUPERADMIN",
    ]
    if not (is_admin or is_platform_admin):
        raise HTTPException(
            status_code=403,
            detail=("Solo el creador/ADMIN del grupo " "puede eliminarlo."),
        )

    await service.delete_group(group_id)
    return None


@router.get(
    "/{group_id}/members",
    response_model=List[ScanGroupMemberResponse],
)
async def get_group_members(
    group_id: int,
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.get_group_members(group_id)


@router.put("/{group_id}/members/{user_id}")
async def update_member_permissions(
    group_id: int,
    user_id: int,
    updates: UpdateMemberPermissions,
    current_user: CurrentUser = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.update_member_permissions(
        group_id, current_user.id, user_id, updates
    )


@router.delete("/{group_id}/members/{user_id}")
async def kick_member(
    group_id: int,
    user_id: int,
    current_user: CurrentUser = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.kick_member(group_id, current_user.id, user_id)
