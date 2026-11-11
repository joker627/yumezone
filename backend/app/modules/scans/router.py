from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    invalidate_user_session,
    is_platform_admin,
)
from app.modules.scans.schemas import (
    AddMemberRequest,
    ConvertAndDonateRequest,
    CreateFundingGoalRequest,
    CreateScanAnnouncementRequest,
    JoinScanRequest,
    RewardMemberRequest,
    ScanGroupCreate,
    ScanGroupMemberResponse,
    ScanGroupResponse,
    ScanGroupUpdate,
    UpdateMemberPermissions,
)
from app.modules.scans.services import ScanGroupService
from app.modules.users.schemas import CurrentUser

router = APIRouter(prefix="/scan-groups", tags=["Scanlators"])


def get_scan_group_service(conn: AsyncSession = Depends(get_db_session)):
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


async def get_current_group_member(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
) -> CurrentUser:
    if is_platform_admin(current_user):
        return current_user
    member = await service.repository.get_member(group_id, current_user.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No perteneces a este grupo.")
    return current_user


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


@router.get("/{group_id}", response_model=ScanGroupResponse)
async def get_group_by_id(
    group_id: int,
    _: CurrentUser = Depends(get_current_group_member),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Obtiene los detalles del clan para el panel de administración."""
    return await service.get_group_by_id(group_id)


@router.get("/{group_id}/works", response_model=List[dict])
async def get_group_works(
    group_id: int,
    _: CurrentUser = Depends(get_current_group_member),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Obtiene el listado de obras asignadas a este clan."""
    return await service.repository.get_scan_works(group_id)


@router.put("/{group_id}", response_model=ScanGroupResponse)
async def update_group(
    group_id: int,
    group_data: ScanGroupUpdate,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    dumped = group_data.model_dump(exclude_unset=True)
    if "name" in dumped and dumped["name"]:
        await require_group_leader(group_id, current_user, service)
    return await service.update_group(group_id, dumped)


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
    _: CurrentUser = Depends(get_current_group_member),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    return await service.get_group_members(group_id)


@router.post("/{group_id}/members", response_model=ScanGroupMemberResponse)
async def add_group_member(
    group_id: int,
    payload: AddMemberRequest,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Añade un miembro al clan por username, user_code o correo."""
    return await service.add_member_by_identifier(group_id, current_user, payload)


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


@router.post("/{group_id}/join")
async def join_group(
    group_id: int,
    payload: Optional[JoinScanRequest] = None,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Permite a un usuario autenticado unirse directamente a un scan desde el perfil público."""
    return await service.join_group(group_id, current_user, payload)


@router.post("/{group_id}/leave")
async def leave_group(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Permite a un miembro abandonar voluntariamente el scan."""
    return await service.leave_group(group_id, current_user)


# ==========================================
# BÓVEDA DEL CLAN, METAS, RECOMPENSAS Y ANUNCIOS
# ==========================================

@router.get("/{group_id}/treasury")
async def get_group_treasury(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Obtiene el estado de la Bóveda de Cristales del Clan, metas activas, mecenas y transacciones."""
    return await service.repository.get_scan_treasury(group_id, current_user.id)


@router.post("/{group_id}/convert-and-donate")
async def convert_and_donate_to_group(
    group_id: int,
    payload: ConvertAndDonateRequest,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Convierte YumeCoins a Cristales de Clan (50:1) y/o aporta Cristales a la Bóveda del Clan o a una meta."""
    try:
        res = await service.repository.convert_and_donate(
            group_id=group_id,
            user_id=current_user.id,
            coins_to_convert=payload.coins_to_convert,
            direct_tokens=payload.direct_tokens,
            goal_id=payload.goal_id,
        )
        await invalidate_user_session(current_user.email)
        return res
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{group_id}/goals")
async def create_group_funding_goal(
    group_id: int,
    payload: CreateFundingGoalRequest,
    _: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Crea una nueva meta de capítulos patrocinados en Cristales para el Clan."""
    return await service.repository.create_funding_goal(
        group_id=group_id,
        title=payload.title,
        description=payload.description,
        work_id=payload.work_id,
        target_tokens=payload.target_tokens,
    )


@router.delete("/{group_id}/goals/{goal_id}")
async def delete_group_funding_goal(
    group_id: int,
    goal_id: int,
    _: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Elimina una meta de patrocinio del Clan."""
    deleted = await service.repository.delete_funding_goal(group_id, goal_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meta no encontrada.")
    return {"message": "Meta eliminada correctamente."}


@router.post("/{group_id}/reward-member")
async def reward_group_member(
    group_id: int,
    payload: RewardMemberRequest,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Convierte Cristales desde la Bóveda del Clan en YumeCoins (+40 YumeCoins por Cristal) para premiar a un miembro del equipo."""
    try:
        res = await service.repository.reward_member_from_vault(
            group_id=group_id,
            actor_user_id=current_user.id,
            target_user_id=payload.target_user_id,
            amount_tokens=payload.amount_tokens,
            reason=payload.reason,
        )
        if res.get("target_email"):
            await invalidate_user_session(res.get("target_email"))
        return res
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{group_id}/upgrade-level")
async def upgrade_group_level(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Sube el Nivel del Clan usando Cristales de la Bóveda (Costo: 40 × Nivel actual)."""
    try:
        return await service.repository.upgrade_clan_level(group_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{group_id}/announcements")
async def list_group_announcements(
    group_id: int,
    _: CurrentUser = Depends(get_current_group_member),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Lista los anuncios activos publicados por este Clan."""
    return await service.repository.get_scan_announcements(group_id)


@router.post("/{group_id}/announcements")
async def create_group_announcement(
    group_id: int,
    payload: CreateScanAnnouncementRequest,
    current_user: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Publica un anuncio del Clan (puede usar 6 Cristales de la Bóveda si es destacado)."""
    try:
        return await service.repository.create_scan_announcement(
            group_id=group_id,
            actor_user_id=current_user.id,
            title=payload.title,
            description=payload.description,
            type_label=payload.type_label,
            use_vault=payload.use_vault,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{group_id}/announcements/{announcement_id}")
async def delete_group_announcement(
    group_id: int,
    announcement_id: int,
    _: CurrentUser = Depends(get_current_group_manager),
    service: ScanGroupService = Depends(get_scan_group_service),
):
    """Elimina un anuncio del Clan."""
    deleted = await service.repository.delete_scan_announcement(group_id, announcement_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anuncio no encontrado.")
    return {"message": "Anuncio eliminado correctamente."}

