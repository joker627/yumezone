import json
from typing import Annotated, Literal, Optional

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import get_db_connection
from app.core.dependencies import get_current_admin_user, get_current_active_user
from app.modules.users.models import CurrentUser

router = APIRouter()


class UserStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "SUSPENDED", "BLOCKED", "DELETED"]


class SettingUpdate(BaseModel):
    value: object
    description: Optional[str] = Field(default=None, max_length=255)


class ReportReview(BaseModel):
    status: Literal["REVIEWING", "RESOLVED", "DISMISSED"]


async def audit(
    conn: aiomysql.Connection, actor_id: int, action: str, entity_type: str,
    entity_id: str, before: object = None, after: object = None,
) -> None:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO audit_logs
              (actor_user_id, action, entity_type, entity_id, before_data, after_data)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (actor_id, action, entity_type, entity_id,
             json.dumps(before) if before is not None else None,
             json.dumps(after) if after is not None else None),
        )


@router.get("/dashboard")
async def dashboard(
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT
              (SELECT COUNT(*) FROM users WHERE status = 'ACTIVE') AS active_users,
              (SELECT COUNT(*) FROM users) AS total_users,
              (SELECT COUNT(*) FROM works) AS works,
              (SELECT COUNT(*) FROM chapters WHERE status = 'PUBLISHED') AS published_chapters,
              (SELECT COUNT(*) FROM content_reports WHERE status IN ('OPEN', 'REVIEWING')) AS open_reports,
              (SELECT COUNT(*) FROM view_logs WHERE viewed_at >= NOW() - INTERVAL 24 HOUR) AS views_last_24h,
              (SELECT COUNT(*) FROM view_logs) AS total_views,
              (SELECT COUNT(*) FROM comments WHERE status != 'DELETED') AS total_comments,
              (SELECT COUNT(*) FROM scan_groups) AS total_scans
            """
        )
        stats = await cur.fetchone()

        await cur.execute(
            """
            SELECT w.id, w.title, w.slug, w.cover_url, COALESCE(s.name, 'En emisión') AS status, w.created_at
            FROM works w
            LEFT JOIN statuses s ON s.id = w.status_id
            ORDER BY w.created_at DESC LIMIT 5
            """
        )
        recent_works = await cur.fetchall()

        await cur.execute(
            """
            SELECT cr.id, cr.entity_type, cr.reason, cr.status, cr.created_at, u.username AS reporter_username
            FROM content_reports cr
            JOIN users u ON u.id = cr.reporter_user_id
            WHERE cr.status IN ('OPEN', 'REVIEWING')
            ORDER BY cr.created_at DESC LIMIT 4
            """
        )
        recent_reports = await cur.fetchall()

        await cur.execute(
            """
            SELECT al.id, al.action, al.entity_type, al.entity_id, al.created_at, u.username AS actor_username
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.actor_user_id
            ORDER BY al.created_at DESC LIMIT 6
            """
        )
        recent_audit = await cur.fetchall()

        # Convertir datetimes a formato ISO string para serialización limpia
        for row in recent_works:
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()
        for row in recent_reports:
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()
        for row in recent_audit:
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()

        return {
            **(stats or {}),
            "recent_works": recent_works or [],
            "recent_reports": recent_reports or [],
            "recent_audit": recent_audit or [],
        }


@router.get("/users")
async def list_users(
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 25,
    q: Optional[str] = Query(default=None, max_length=100),
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    params: list[object] = []
    where = ""
    if q:
        where = "WHERE username LIKE %s OR email LIKE %s OR user_code LIKE %s"
        term = f"%{q.strip()}%"
        params.extend([term, term, term])
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(f"SELECT COUNT(*) AS total FROM users {where}", tuple(params))
        total = (await cur.fetchone())["total"]
        await cur.execute(
            f"""
            SELECT id, user_code, username, email, platform_role, status, xp, coins, created_at, updated_at
            FROM users {where}
            ORDER BY created_at DESC LIMIT %s OFFSET %s
            """,
            (*params, per_page, (page - 1) * per_page),
        )
        return {"data": await cur.fetchall(), "page": page, "per_page": per_page, "total": total}


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio estado")
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("SELECT status FROM users WHERE id = %s", (user_id,))
        row = await cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        await cur.execute("UPDATE users SET status = %s WHERE id = %s", (payload.status, user_id))
    await audit(conn, current_user.id, "user.status.update", "user", str(user_id), row, {"status": payload.status})
    await conn.commit()
    return {"id": user_id, "status": payload.status}


@router.get("/settings")
async def list_settings(
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("SELECT setting_key, setting_value, description FROM platform_settings ORDER BY setting_key")
        return {"data": await cur.fetchall()}


@router.put("/settings/{setting_key}")
async def put_setting(
    setting_key: str,
    payload: SettingUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    if not 1 <= len(setting_key) <= 100:
        raise HTTPException(status_code=422, detail="setting_key debe tener entre 1 y 100 caracteres")
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("SELECT setting_value FROM platform_settings WHERE setting_key = %s", (setting_key,))
        before = await cur.fetchone()
        await cur.execute(
            """
            INSERT INTO platform_settings (setting_key, setting_value, description)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description)
            """,
            (setting_key, json.dumps(payload.value), payload.description),
        )
    await audit(conn, current_user.id, "setting.put", "platform_setting", setting_key, before, payload.model_dump())
    await conn.commit()
    return {"setting_key": setting_key, "value": payload.value, "description": payload.description}


@router.get("/audit-logs")
async def list_audit_logs(
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT al.*, u.username AS actor_username
            FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
            ORDER BY al.created_at DESC LIMIT %s
            """,
            (limit,),
        )
        return {"data": await cur.fetchall()}


@router.get("/reports")
async def list_reports(
    report_status: Optional[Literal["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    where = "WHERE cr.status = %s" if report_status else ""
    params = (report_status, limit) if report_status else (limit,)
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            f"""
            SELECT cr.*, reporter.username AS reporter_username, reviewer.username AS reviewer_username
            FROM content_reports cr
            JOIN users reporter ON reporter.id = cr.reporter_user_id
            LEFT JOIN users reviewer ON reviewer.id = cr.reviewed_by
            {where}
            ORDER BY cr.created_at DESC LIMIT %s
            """,
            params,
        )
        return {"data": await cur.fetchall()}


@router.patch("/reports/{report_id}")
async def review_report(
    report_id: int,
    payload: ReportReview,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("SELECT status FROM content_reports WHERE id = %s", (report_id,))
        before = await cur.fetchone()
        if before is None:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        await cur.execute(
            """
            UPDATE content_reports
            SET status = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (payload.status, current_user.id, report_id),
        )
    await audit(conn, current_user.id, "report.review", "content_report", str(report_id), before, payload.model_dump())
    await conn.commit()
    return {"id": report_id, "status": payload.status}


class UserRoleUpdate(BaseModel):
    platform_role: Literal["USER", "ADMIN", "SUPERADMIN"]


class AnnouncementCreate(BaseModel):
    type: Literal["sistema", "evento", "scan"] = "sistema"
    type_label: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    source: Optional[str] = "Oficial"


class WorkAdminUpdate(BaseModel):
    title: Optional[str] = None
    synopsis: Optional[str] = None
    status_id: Optional[int] = None
    scan_group_id: Optional[int] = None


class ScanMemberRoleUpdate(BaseModel):
    role: Literal["ADMIN", "MODERATOR", "MEMBER"]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    if current_user.platform_role.upper() != "SUPERADMIN":
        raise HTTPException(status_code=403, detail="Solo el Superadmin puede cambiar roles de plataforma")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes alterar tu propio rol de Superadmin")
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("SELECT platform_role FROM users WHERE id = %s", (user_id,))
        row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        await cur.execute("UPDATE users SET platform_role = %s WHERE id = %s", (payload.platform_role, user_id))
    await audit(conn, current_user.id, "user.role.update", "user", str(user_id), row, {"platform_role": payload.platform_role})
    await conn.commit()
    return {"id": user_id, "platform_role": payload.platform_role}


@router.get("/announcements")
async def list_announcements_admin(
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("SELECT * FROM home_announcements ORDER BY created_at DESC LIMIT 100")
        return {"data": await cur.fetchall()}


@router.post("/announcements", status_code=201)
async def create_announcement_admin(
    payload: AnnouncementCreate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            INSERT INTO home_announcements (type, type_label, source, title, description, is_active)
            VALUES (%s, %s, %s, %s, %s, TRUE)
            """,
            (payload.type, payload.type_label, payload.source or "Oficial", payload.title, payload.description),
        )
        announcement_id = cur.lastrowid
    await audit(conn, current_user.id, "announcement.create", "announcement", str(announcement_id), None, payload.model_dump())
    await conn.commit()
    return {"id": announcement_id, "message": "Anuncio creado con éxito"}


@router.delete("/announcements/{announcement_id}")
async def delete_announcement_admin(
    announcement_id: int,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("DELETE FROM home_announcements WHERE id = %s", (announcement_id,))
    await audit(conn, current_user.id, "announcement.delete", "announcement", str(announcement_id))
    await conn.commit()
    return {"id": announcement_id, "message": "Anuncio eliminado"}


@router.get("/works")
async def list_works_admin(
    q: Optional[str] = Query(default=None, max_length=100),
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    where = "WHERE w.title LIKE %s OR w.slug LIKE %s" if q else ""
    params = (f"%{q.strip()}%", f"%{q.strip()}%", limit, offset) if q else (limit, offset)
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            f"""
            SELECT w.id, w.title, w.slug, w.cover_url, w.status_id, w.scan_group_id,
                   s.name AS status_name, sg.name AS scan_group_name,
                   (SELECT COUNT(*) FROM chapters WHERE work_id = w.id) AS chapters_count
            FROM works w
            LEFT JOIN statuses s ON s.id = w.status_id
            LEFT JOIN scan_groups sg ON sg.id = w.scan_group_id
            {where}
            ORDER BY w.updated_at DESC LIMIT %s OFFSET %s
            """,
            params,
        )
        return {"data": await cur.fetchall()}


@router.patch("/works/{work_id}")
async def update_work_admin(
    work_id: int,
    payload: WorkAdminUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    updates = []
    vals = []
    if payload.title is not None:
        updates.append("title = %s")
        vals.append(payload.title.strip())
    if payload.synopsis is not None:
        updates.append("synopsis = %s")
        vals.append(payload.synopsis.strip())
    if payload.status_id is not None:
        updates.append("status_id = %s")
        vals.append(payload.status_id)
    if payload.scan_group_id is not None:
        updates.append("scan_group_id = %s")
        vals.append(payload.scan_group_id)

    if not updates:
        return {"id": work_id, "message": "Sin cambios"}

    vals.append(work_id)
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(f"UPDATE works SET {', '.join(updates)} WHERE id = %s", tuple(vals))
    await audit(conn, current_user.id, "work.update", "work", str(work_id), None, payload.model_dump(exclude_unset=True))
    await conn.commit()
    return {"id": work_id, "message": "Obra actualizada"}


@router.get("/comments")
async def list_comments_admin(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT c.id, c.work_id, c.content, c.status, c.created_at,
                   u.username, u.avatar_url, w.title AS work_title
            FROM comments c
            JOIN users u ON u.id = c.user_id
            JOIN works w ON w.id = c.work_id
            ORDER BY c.created_at DESC LIMIT %s
            """,
            (limit,),
        )
        return {"data": await cur.fetchall()}


@router.delete("/comments/{comment_id}")
async def delete_comment_admin(
    comment_id: int,
    current_user: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("UPDATE comments SET status = 'DELETED', content = '[Comentario moderado por el Staff]' WHERE id = %s", (comment_id,))
    await audit(conn, current_user.id, "comment.delete", "comment", str(comment_id))
    await conn.commit()
    return {"id": comment_id, "message": "Comentario moderado"}


@router.get("/scan-groups")
async def list_scan_groups_admin(
    _: CurrentUser = Depends(get_current_admin_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT sg.id, sg.name, sg.slug, sg.logo_url, sg.status, sg.created_at,
                   COUNT(DISTINCT sgm.user_id) AS members_count,
                   (SELECT COUNT(*) FROM works WHERE scan_group_id = sg.id) AS works_count
            FROM scan_groups sg
            LEFT JOIN scan_group_members sgm ON sgm.group_id = sg.id
            GROUP BY sg.id
            ORDER BY sg.name ASC
            """
        )
        return {"data": await cur.fetchall()}


@router.get("/my-scan-groups")
async def list_my_scan_groups(
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT sg.id, sg.name, sg.slug, sg.logo_url, sgm.role, sgm.joined_at,
                   (SELECT COUNT(*) FROM works WHERE scan_group_id = sg.id) AS works_count
            FROM scan_group_members sgm
            JOIN scan_groups sg ON sg.id = sgm.group_id
            WHERE sgm.user_id = %s
            ORDER BY sgm.joined_at DESC
            """,
            (current_user.id,),
        )
        return {"data": await cur.fetchall()}


@router.patch("/scan-groups/{group_id}/members/{target_user_id}")
async def update_scan_member_role(
    group_id: int,
    target_user_id: int,
    payload: ScanMemberRoleUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    is_platform_admin = current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]
    async with conn.cursor(aiomysql.DictCursor) as cur:
        if not is_platform_admin:
            await cur.execute(
                "SELECT role FROM scan_group_members WHERE group_id = %s AND user_id = %s",
                (group_id, current_user.id),
            )
            my_membership = await cur.fetchone()
            if not my_membership or my_membership["role"] != "ADMIN":
                raise HTTPException(status_code=403, detail="Solo el Administrador del Scan puede modificar roles")
        await cur.execute(
            "UPDATE scan_group_members SET role = %s WHERE group_id = %s AND user_id = %s",
            (payload.role, group_id, target_user_id),
        )
    await audit(conn, current_user.id, "scan.member.role", "scan_member", f"{group_id}:{target_user_id}", None, payload.model_dump())
    await conn.commit()
    return {"group_id": group_id, "user_id": target_user_id, "role": payload.role}

