from fastapi import APIRouter, Depends, status, HTTPException
from typing import List
from app.modules.scans.schemas import (
    ScanGroupCreate, ScanGroupResponse, ScanGroupMemberResponse, 
    InviteUserRequest, ScanGroupInvitationResponse, UpdateMemberPermissions,
    ScanGroupUpdate
)
from app.modules.scans.services import ScanGroupService
from app.core.dependencies import get_current_active_user, get_current_admin_user
from app.modules.users.models import User
from app.core.database import get_db_pool
import aiomysql
import json

router = APIRouter(tags=["Scan Groups"])

def get_scan_group_service():
    return ScanGroupService()

# Dependencia para verificar permisos de administrador de grupo
async def get_current_group_admin(
    group_id: int, 
    current_user: User = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    member = await service.repository.get_member(group_id, current_user.id)
    if not member:
        # Fallback to Superadmin
        if current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]:
            return current_user
        raise HTTPException(status_code=403, detail="No perteneces a este grupo.")
    if member.role not in ['ADMIN', 'MODERATOR']:
        raise HTTPException(status_code=403, detail="No tienes permisos de administración en este grupo.")
    return current_user

@router.post("/", response_model=ScanGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: ScanGroupCreate,
    current_user: User = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    return await service.create_group(current_user, group_data)

@router.put("/{group_id}", response_model=ScanGroupResponse)
async def update_group(
    group_id: int,
    group_data: ScanGroupUpdate,
    current_user: User = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    member = await service.repository.get_member(group_id, current_user.id)
    # Solo el ADMIN del grupo o un superadmin de la plataforma puede editar perfil del grupo
    if not (member and member.role == 'ADMIN') and not (current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]):
        raise HTTPException(status_code=403, detail="Solo el creador/ADMIN del grupo puede editar su perfil.")
        
    return await service.update_group(group_id, group_data.model_dump(exclude_unset=True))

@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    member = await service.repository.get_member(group_id, current_user.id)
    # Solo el ADMIN del grupo o un superadmin de la plataforma puede borrar el grupo
    if not (member and member.role == 'ADMIN') and not (current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]):
        raise HTTPException(status_code=403, detail="Solo el creador/ADMIN del grupo puede eliminarlo.")
        
    await service.delete_group(group_id)
    return None

@router.get("/{group_id}/members", response_model=List[ScanGroupMemberResponse])
async def get_group_members(
    group_id: int,
    service: ScanGroupService = Depends(get_scan_group_service)
):
    return await service.get_group_members(group_id)

@router.post("/{group_id}/invite", status_code=status.HTTP_201_CREATED)
async def invite_user(
    group_id: int,
    data: InviteUserRequest,
    current_user: User = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    return await service.invite_user(group_id, current_user, data.user_code)

@router.get("/invitations/me", response_model=List[ScanGroupInvitationResponse])
async def get_my_invitations(
    current_user: User = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    return await service.get_my_invitations(current_user.id)

@router.post("/invitations/{invite_id}/respond")
async def respond_invitation(
    invite_id: int,
    accept: bool,
    current_user: User = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    return await service.respond_invitation(invite_id, current_user.id, accept)

@router.put("/{group_id}/members/{user_id}")
async def update_member_permissions(
    group_id: int,
    user_id: int,
    updates: UpdateMemberPermissions,
    current_user: User = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    return await service.update_member_permissions(group_id, current_user.id, user_id, updates)

@router.delete("/{group_id}/members/{user_id}")
async def kick_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_group_admin),
    service: ScanGroupService = Depends(get_scan_group_service)
):
    return await service.kick_member(group_id, current_user.id, user_id)
