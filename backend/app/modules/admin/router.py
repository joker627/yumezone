from typing import Annotated, Literal, Optional
import aiomysql
from fastapi import APIRouter, Depends, Query

from app.core.database import get_db_connection
from app.core.dependencies import get_current_admin_user, get_current_active_user
from app.modules.admin.repository import AdminRepository
from app.modules.admin.schemas import (
    AnnouncementCreate,
    ReportReview,
    ScanMemberRoleUpdate,
    SettingUpdate,
    UserRoleUpdate,
    UserStatusUpdate,
    WorkAdminUpdate,
)
from app.modules.admin.services import AdminService
from app.modules.users.models import CurrentUser

router = APIRouter()


def get_admin_service(conn: aiomysql.Connection = Depends(get_db_connection)) -> AdminService:
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
