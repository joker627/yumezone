from typing import Annotated, Literal, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import (
    get_current_admin_user,
    get_current_active_user,
    get_optional_current_user,
)
from app.modules.admin.repository import AdminRepository
from app.modules.admin.schemas import (
    AnnouncementCreate,
    ReportReview,
    ScanMemberRoleUpdate,
    SettingUpdate,
    UserRoleUpdate,
    UserStatusUpdate,
    ViewLogCreate,
    WorkAdminUpdate,
)
from app.modules.admin.services import AdminService
from app.modules.users.schemas import CurrentUser
from app.utils.network import get_client_ip

router = APIRouter(prefix="/admin", tags=["Administración"])
metrics_router = APIRouter(prefix="/metrics", tags=["Métricas"])


def get_admin_service(conn: AsyncSession = Depends(get_db_session)) -> AdminService:
    repository = AdminRepository(conn)
    return AdminService(repository)


@router.get("/dashboard")
async def dashboard(
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.get_dashboard()


@router.get("/users")
async def list_users(
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 25,
    q: Optional[str] = Query(default=None, max_length=100),
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.list_users(page=page, per_page=per_page, q=q)


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.update_user_status(user_id, payload, current_user)


@router.get("/settings")
async def list_settings(
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    settings = await service.list_settings()
    return {"data": settings}


@router.put("/settings/{setting_key}")
async def put_setting(
    setting_key: str,
    payload: SettingUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.put_setting(setting_key, payload, current_user)


@router.get("/audit-logs")
async def list_audit_logs(
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    logs = await service.list_audit_logs(limit)
    return {"data": logs}


@router.get("/reports")
async def list_reports(
    report_status: Optional[Literal["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    reports = await service.list_reports(report_status, limit)
    return {"data": reports}


@router.patch("/reports/{report_id}")
async def review_report(
    report_id: int,
    payload: ReportReview,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.review_report(report_id, payload, current_user)


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.update_user_role(user_id, payload, current_user)


@router.get("/announcements")
async def list_announcements_admin(
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    announcements = await service.list_announcements()
    return {"data": announcements}


@router.post("/announcements", status_code=201)
async def create_announcement_admin(
    payload: AnnouncementCreate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.create_announcement(payload, current_user)


@router.delete("/announcements/{announcement_id}")
async def delete_announcement_admin(
    announcement_id: int,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.delete_announcement(announcement_id, current_user)


@router.get("/works")
async def list_works_admin(
    q: Optional[str] = Query(default=None, max_length=100),
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    works = await service.list_works(q, limit, offset)
    return {"data": works}


@router.patch("/works/{work_id}")
async def update_work_admin(
    work_id: int,
    payload: WorkAdminUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.update_work(work_id, payload, current_user)


@router.get("/comments")
async def list_comments_admin(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    comments = await service.list_comments(limit)
    return {"data": comments}


@router.delete("/comments/{comment_id}")
async def delete_comment_admin(
    comment_id: int,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.delete_comment(comment_id, current_user)


@router.get("/scan-groups")
async def list_scan_groups_admin(
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    groups = await service.list_scan_groups()
    return {"data": groups}


@router.get("/my-scan-groups")
async def list_my_scan_groups(
    current_user: CurrentUser = Depends(get_current_active_user),
    service: AdminService = Depends(get_admin_service),
):
    groups = await service.list_my_scan_groups(current_user)
    return {"data": groups}


@router.patch("/scan-groups/{group_id}/members/{target_user_id}")
async def update_scan_member_role(
    group_id: int,
    target_user_id: int,
    payload: ScanMemberRoleUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: AdminService = Depends(get_admin_service),
):
    return await service.update_scan_member_role(group_id, target_user_id, payload, current_user)


# ==========================================
# GESTIÓN DE MISIONES DINÁMICAS Y EVENTOS (EXCLUSIVO ADMIN)
# ==========================================

@router.get("/missions")
async def list_admin_missions(
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    """Lista todas las misiones diarias, semanales y de eventos configuradas en la plataforma."""
    return {"data": await service.list_missions()}


@router.post("/missions")
async def create_admin_mission(
    payload: dict,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    """Crea una nueva misión diaria, semanal o de evento temporal."""
    return await service.create_mission(payload, current_user)


@router.put("/missions/{mission_id}")
async def update_admin_mission(
    mission_id: int,
    payload: dict,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    """Edita recompensas, fechas de evento, estado o metas de una misión."""
    return await service.update_mission(mission_id, payload, current_user)


@router.delete("/missions/{mission_id}")
async def delete_admin_mission(
    mission_id: int,
    current_user: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    """Elimina una misión del sistema."""
    return await service.delete_mission(mission_id, current_user)


# Endpoints de Métricas integrados (/api/v1/metrics)
@metrics_router.post("/views", status_code=status.HTTP_204_NO_CONTENT)
async def log_view(
    data: ViewLogCreate,
    request: Request,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    service: AdminService = Depends(get_admin_service),
):
    client_ip = get_client_ip(request)
    await service.log_view(data, client_ip, current_user)
    return None


@metrics_router.post("/compute", status_code=status.HTTP_200_OK)
async def compute_statistics(
    _: CurrentUser = Depends(get_current_admin_user),
    service: AdminService = Depends(get_admin_service),
):
    await service.compute_statistics()
    return {"status": "ok"}

