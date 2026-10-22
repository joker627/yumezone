from typing import Any, Dict, List, Optional
from fastapi import HTTPException

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
from app.modules.users.models import CurrentUser


class AdminService:
    def __init__(self, repository: AdminRepository):
        self.repo = repository

    async def get_dashboard(self) -> Dict[str, Any]:
        return await self.repo.get_dashboard_stats()

    async def list_users(self, page: int, per_page: int, q: Optional[str] = None) -> Dict[str, Any]:
        return await self.repo.list_users(page=page, per_page=per_page, q=q)

    async def update_user_status(
        self, target_user_id: int, payload: UserStatusUpdate, current_user: CurrentUser
    ) -> Dict[str, Any]:
        if target_user_id == current_user.id:
            raise HTTPException(status_code=400, detail="No puedes cambiar tu propio estado")

        row = await self.repo.get_user_by_id(target_user_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if (
            row["platform_role"].upper() in ("ADMIN", "SUPERADMIN")
            and current_user.platform_role.upper() != "SUPERADMIN"
        ):
            raise HTTPException(
                status_code=403,
                detail="Solo el Superadmin puede cambiar el estado de una cuenta de Administrador",
            )

        await self.repo.update_user_status(target_user_id, payload.status)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="user.status.update",
            entity_type="user",
            entity_id=str(target_user_id),
            before=row,
            after={"status": payload.status},
        )
        return {"id": target_user_id, "status": payload.status}

    async def list_settings(self) -> List[Dict[str, Any]]:
        return await self.repo.list_settings()

    async def put_setting(
        self, setting_key: str, payload: SettingUpdate, current_user: CurrentUser
    ) -> Dict[str, Any]:
        if not 1 <= len(setting_key) <= 100:
            raise HTTPException(status_code=422, detail="setting_key debe tener entre 1 y 100 caracteres")

        before = await self.repo.get_setting(setting_key)
        await self.repo.upsert_setting(setting_key, payload.value, payload.description)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="setting.put",
            entity_type="platform_setting",
            entity_id=setting_key,
            before=before,
            after=payload.model_dump(),
        )
        return {"setting_key": setting_key, "value": payload.value, "description": payload.description}

    async def list_audit_logs(self, limit: int) -> List[Dict[str, Any]]:
        return await self.repo.list_audit_logs(limit)

    async def list_reports(self, report_status: Optional[str], limit: int) -> List[Dict[str, Any]]:
        return await self.repo.list_reports(report_status, limit)

    async def review_report(
        self, report_id: int, payload: ReportReview, current_user: CurrentUser
    ) -> Dict[str, Any]:
        before = await self.repo.get_report_by_id(report_id)
        if before is None:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")

        await self.repo.update_report(report_id, payload.status, current_user.id)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="report.review",
            entity_type="content_report",
            entity_id=str(report_id),
            before=before,
            after=payload.model_dump(),
        )
        return {"id": report_id, "status": payload.status}

    async def update_user_role(
        self, target_user_id: int, payload: UserRoleUpdate, current_user: CurrentUser
    ) -> Dict[str, Any]:
        if current_user.platform_role.upper() != "SUPERADMIN":
            raise HTTPException(status_code=403, detail="Solo el Superadmin puede cambiar roles de plataforma")
        if target_user_id == current_user.id:
            raise HTTPException(status_code=400, detail="No puedes alterar tu propio rol de Superadmin")

        row = await self.repo.get_user_by_id(target_user_id)
        if not row:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        await self.repo.update_user_role(target_user_id, payload.platform_role)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="user.role.update",
            entity_type="user",
            entity_id=str(target_user_id),
            before=row,
            after={"platform_role": payload.platform_role},
        )
        return {"id": target_user_id, "platform_role": payload.platform_role}

    async def list_announcements(self) -> List[Dict[str, Any]]:
        return await self.repo.list_announcements(100)

    async def create_announcement(
        self, payload: AnnouncementCreate, current_user: CurrentUser
    ) -> Dict[str, Any]:
        announcement_id = await self.repo.create_announcement(
            type=payload.type,
            type_label=payload.type_label,
            source=payload.source or "Oficial",
            title=payload.title,
            description=payload.description,
        )
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="announcement.create",
            entity_type="announcement",
            entity_id=str(announcement_id),
            before=None,
            after=payload.model_dump(),
        )
        return {"id": announcement_id, "message": "Anuncio creado con éxito"}

    async def delete_announcement(self, announcement_id: int, current_user: CurrentUser) -> Dict[str, Any]:
        await self.repo.delete_announcement(announcement_id)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="announcement.delete",
            entity_type="announcement",
            entity_id=str(announcement_id),
        )
        return {"id": announcement_id, "message": "Anuncio eliminado"}

    async def list_works(self, q: Optional[str], limit: int, offset: int) -> List[Dict[str, Any]]:
        return await self.repo.list_works(q=q, limit=limit, offset=offset)

    async def update_work(
        self, work_id: int, payload: WorkAdminUpdate, current_user: CurrentUser
    ) -> Dict[str, Any]:
        updates = {}
        if payload.title is not None:
            updates["title"] = payload.title.strip()
        if payload.synopsis is not None:
            updates["synopsis"] = payload.synopsis.strip()
        if payload.status_id is not None:
            updates["status_id"] = payload.status_id
        if payload.scan_group_id is not None:
            updates["scan_group_id"] = payload.scan_group_id

        if not updates:
            return {"id": work_id, "message": "Sin cambios"}

        await self.repo.update_work(work_id, updates)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="work.update",
            entity_type="work",
            entity_id=str(work_id),
            before=None,
            after=payload.model_dump(exclude_unset=True),
        )
        return {"id": work_id, "message": "Obra actualizada"}

    async def list_comments(self, limit: int) -> List[Dict[str, Any]]:
        return await self.repo.list_comments(limit)

    async def delete_comment(self, comment_id: int, current_user: CurrentUser) -> Dict[str, Any]:
        await self.repo.moderate_delete_comment(comment_id)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="comment.delete",
            entity_type="comment",
            entity_id=str(comment_id),
        )
        return {"id": comment_id, "message": "Comentario moderado"}

    async def list_scan_groups(self) -> List[Dict[str, Any]]:
        return await self.repo.list_scan_groups()

    async def list_my_scan_groups(self, current_user: CurrentUser) -> List[Dict[str, Any]]:
        return await self.repo.list_user_scan_groups(current_user.id)

    async def update_scan_member_role(
        self, group_id: int, target_user_id: int, payload: ScanMemberRoleUpdate, current_user: CurrentUser
    ) -> Dict[str, Any]:
        is_platform_admin = current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]
        if not is_platform_admin:
            my_membership = await self.repo.get_scan_membership(group_id, current_user.id)
            if not my_membership or my_membership["role"] != "ADMIN":
                raise HTTPException(status_code=403, detail="Solo el Administrador del Scan puede modificar roles")

        await self.repo.update_scan_member_role(group_id, target_user_id, payload.role)
        await self.repo.log_audit(
            actor_id=current_user.id,
            action="scan.member.role",
            entity_type="scan_member",
            entity_id=f"{group_id}:{target_user_id}",
            before=None,
            after=payload.model_dump(),
        )
        return {"group_id": group_id, "user_id": target_user_id, "role": payload.role}
