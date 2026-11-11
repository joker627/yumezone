from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.series.models import WorkORM, WorkStatisticsORM
from app.modules.chapters.models import ChapterORM
from app.modules.admin.models import (
    AuditLogORM,
    ContentReportORM,
    PlatformSettingORM,
    ViewLogORM,
)
from app.modules.comments.models import CommentORM
from app.modules.home.models import AnnouncementORM
from app.modules.shop.models import DailyMissionORM
from app.modules.scans.models import ScanGroupMemberORM
from app.modules.users.models import UserORM
from app.utils.formatters import parse_json_safe


class AdminRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def log_audit(
        self,
        actor_id: int,
        action: str,
        entity_type: str,
        entity_id: str,
        before: object = None,
        after: object = None,
    ) -> None:
        async with resolve_session(self.conn) as session:
            session.add(
                AuditLogORM(
                    actor_user_id=actor_id,
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    before_data=before,
                    after_data=after,
                )
            )
            await session.commit()

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            stats_res = await session.execute(
                text(
                    """
                    SELECT
                      (SELECT COUNT(*) FROM users WHERE status = 'ACTIVE') AS active_users,
                      (SELECT COUNT(*) FROM users) AS total_users,
                      (SELECT COUNT(*) FROM works) AS works,
                      (SELECT COUNT(*) FROM chapters WHERE status = 'PUBLISHED') AS published_chapters,
                      (SELECT COUNT(*) FROM content_reports WHERE status IN ('OPEN', 'REVIEWING')) AS open_reports,
                      (SELECT COUNT(*) FROM view_logs WHERE viewed_at >= NOW() - INTERVAL '24 hours') AS views_last_24h,
                      (SELECT COUNT(*) FROM view_logs) AS total_views,
                      (SELECT COUNT(*) FROM comments WHERE status != 'DELETED') AS total_comments,
                      (SELECT COUNT(*) FROM scan_groups) AS total_scans
                    """
                )
            )
            stats = dict(stats_res.mappings().first() or {})

            rw_res = await session.execute(
                text(
                    """
                    SELECT w.id, w.title, w.slug, w.cover_url, COALESCE(s.name, 'En emisión') AS status, w.created_at
                    FROM works w
                    LEFT JOIN statuses s ON s.id = w.status_id
                    ORDER BY w.created_at DESC LIMIT 5
                    """
                )
            )
            recent_works = [dict(r) for r in rw_res.mappings().all()]

            rr_res = await session.execute(
                text(
                    """
                    SELECT cr.id, cr.entity_type, cr.reason, cr.status, cr.created_at, u.username AS reporter_username
                    FROM content_reports cr
                    JOIN users u ON u.id = cr.reporter_user_id
                    WHERE cr.status IN ('OPEN', 'REVIEWING')
                    ORDER BY cr.created_at DESC LIMIT 4
                    """
                )
            )
            recent_reports = [dict(r) for r in rr_res.mappings().all()]

            ra_res = await session.execute(
                text(
                    """
                    SELECT al.id, al.action, al.entity_type, al.entity_id, al.created_at, u.username AS actor_username
                    FROM audit_logs al
                    LEFT JOIN users u ON u.id = al.actor_user_id
                    ORDER BY al.created_at DESC LIMIT 6
                    """
                )
            )
            recent_audit = [dict(r) for r in ra_res.mappings().all()]

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
                **stats,
                "recent_works": recent_works,
                "recent_reports": recent_reports,
                "recent_audit": recent_audit,
            }

    async def list_users(
        self, page: int, per_page: int, q: Optional[str] = None
    ) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            count_stmt = select(func.count()).select_from(UserORM)
            data_stmt = select(
                UserORM.id,
                UserORM.user_code,
                UserORM.username,
                UserORM.email,
                UserORM.platform_role,
                UserORM.status,
                UserORM.xp,
                UserORM.coins,
                UserORM.created_at,
                UserORM.updated_at,
            )
            if q:
                term = f"%{q.strip()}%"
                cond = or_(
                    UserORM.username.ilike(term),
                    UserORM.email.ilike(term),
                    UserORM.user_code.ilike(term),
                )
                count_stmt = count_stmt.where(cond)
                data_stmt = data_stmt.where(cond)

            total_res = await session.execute(count_stmt)
            total = int(total_res.scalar() or 0)

            data_stmt = (
                data_stmt.order_by(UserORM.created_at.desc())
                .limit(per_page)
                .offset((page - 1) * per_page)
            )
            rows_res = await session.execute(data_stmt)
            rows = [dict(r) for r in rows_res.mappings().all()]
            return {
                "data": rows,
                "page": page,
                "per_page": per_page,
                "total": total,
            }

    async def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    UserORM.id, UserORM.status, UserORM.platform_role
                ).where(UserORM.id == user_id)
            )
            row = res.mappings().first()
            return dict(row) if row else None

    async def update_user_status(self, user_id: int, status: str) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(UserORM)
                .where(UserORM.id == user_id)
                .values(status=status)
            )
            await session.commit()

    async def update_user_role(self, user_id: int, role: str) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(UserORM)
                .where(UserORM.id == user_id)
                .values(platform_role=role)
            )
            await session.commit()

    async def list_settings(self) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    PlatformSettingORM.setting_key,
                    PlatformSettingORM.setting_value,
                    PlatformSettingORM.description,
                ).order_by(PlatformSettingORM.setting_key.asc())
            )
            rows = [dict(r) for r in res.mappings().all()]
            for r in rows:
                sv = r.get("setting_value")
                r["setting_value"] = (
                    sv
                    if isinstance(sv, (dict, list))
                    else parse_json_safe(sv, default=sv)
                )
            return rows

    async def get_setting(self, setting_key: str) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    PlatformSettingORM.setting_key,
                    PlatformSettingORM.setting_value,
                    PlatformSettingORM.description,
                ).where(PlatformSettingORM.setting_key == setting_key)
            )
            r = res.mappings().first()
            if r:
                row = dict(r)
                sv = row.get("setting_value")
                row["setting_value"] = (
                    sv
                    if isinstance(sv, (dict, list))
                    else parse_json_safe(sv, default=sv)
                )
                return row
            return None

    async def update_setting(
        self,
        setting_key: str,
        value: Any,
        description: Optional[str] = None,
    ) -> None:
        async with resolve_session(self.conn) as session:
            stmt = (
                pg_insert(PlatformSettingORM)
                .values(
                    setting_key=setting_key,
                    setting_value=value,
                    description=description,
                )
                .on_conflict_do_update(
                    index_elements=[PlatformSettingORM.setting_key],
                    set_={"setting_value": value, "description": description},
                )
            )
            await session.execute(stmt)
            await session.commit()

    async def list_audit_logs(self, limit: int) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT al.*, u.username AS actor_username
                    FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
                    ORDER BY al.created_at DESC LIMIT :limit
                    """
                ),
                {"limit": limit},
            )
            rows = [dict(r) for r in res.mappings().all()]
            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()
            return rows

    async def list_reports(
        self, status: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        where = "WHERE cr.status = :st" if status else ""
        params: Dict[str, Any] = {"limit": limit}
        if status:
            params["st"] = status
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    f"""
                    SELECT cr.*, u.username AS reporter_username
                    FROM content_reports cr JOIN users u ON u.id = cr.reporter_user_id
                    {where}
                    ORDER BY cr.created_at DESC LIMIT :limit
                    """
                ),
                params,
            )
            rows = [dict(r) for r in res.mappings().all()]
            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()
            return rows

    async def get_report_by_id(
        self, report_id: int
    ) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ContentReportORM).where(
                    ContentReportORM.id == report_id
                )
            )
            r = res.scalar_one_or_none()
            return r.to_dict() if r else None

    async def update_report(
        self, report_id: int, status: str, reviewer_id: int
    ) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(ContentReportORM)
                .where(ContentReportORM.id == report_id)
                .values(
                    status=status,
                    reviewed_by=reviewer_id,
                    reviewed_at=func.current_timestamp(),
                )
            )
            await session.commit()

    async def list_announcements(
        self, limit: int = 100
    ) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(AnnouncementORM)
                .order_by(AnnouncementORM.created_at.desc())
                .limit(limit)
            )
            return [a.to_dict() for a in res.scalars().all()]

    async def create_announcement(
        self,
        type: str,
        type_label: str,
        source: str,
        title: str,
        description: Optional[str],
    ) -> int:
        async with resolve_session(self.conn) as session:
            ann = AnnouncementORM(
                type=type,
                type_label=type_label,
                source=source,
                title=title,
                description=description,
                is_active=True,
            )
            session.add(ann)
            await session.commit()
            return ann.id

    async def delete_announcement(self, announcement_id: int) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                delete(AnnouncementORM).where(
                    AnnouncementORM.id == announcement_id
                )
            )
            await session.commit()

    async def list_works(
        self, q: Optional[str], limit: int, offset: int
    ) -> List[Dict[str, Any]]:
        where = "WHERE w.title ILIKE :q OR w.slug ILIKE :q" if q else ""
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if q:
            params["q"] = f"%{q.strip()}%"
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    f"""
                    SELECT w.id, w.title, w.slug, w.cover_url, w.status_id, w.scan_group_id,
                           s.name AS status_name, sg.name AS scan_group_name,
                           COALESCE(ws.chapters_count, 0) AS chapters_count
                    FROM works w
                    LEFT JOIN work_statistics ws ON ws.work_id = w.id
                    LEFT JOIN statuses s ON s.id = w.status_id
                    LEFT JOIN scan_groups sg ON sg.id = w.scan_group_id
                    {where}
                    ORDER BY w.updated_at DESC LIMIT :limit OFFSET :offset
                    """
                ),
                params,
            )
            return [dict(r) for r in res.mappings().all()]

    async def update_work(
        self, work_id: int, updates: Dict[str, Any]
    ) -> None:
        allowed_cols = {c.name for c in WorkORM.__table__.columns}
        clean_updates = {k: v for k, v in updates.items() if k in allowed_cols}
        if not clean_updates:
            return
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(WorkORM)
                .where(WorkORM.id == work_id)
                .values(**clean_updates)
            )
            await session.commit()

    async def list_comments(self, limit: int = 50) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT c.id, c.work_id, c.content, c.status, c.created_at,
                           u.username, u.avatar_url, w.title AS work_title
                    FROM comments c
                    JOIN users u ON u.id = c.user_id
                    JOIN works w ON w.id = c.work_id
                    ORDER BY c.created_at DESC LIMIT :limit
                    """
                ),
                {"limit": limit},
            )
            return [dict(r) for r in res.mappings().all()]

    async def moderate_delete_comment(self, comment_id: int) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(CommentORM)
                .where(CommentORM.id == comment_id)
                .values(
                    status="DELETED",
                    content="[Comentario moderado por la Administración]",
                )
            )
            await session.commit()

    async def list_scan_groups(self) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
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
            )
            return [dict(r) for r in res.mappings().all()]

    async def list_user_scan_groups(self, user_id: int) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT sg.id, sg.name, sg.slug, sg.logo_url, sgm.role, sgm.joined_at,
                           (SELECT COUNT(*) FROM works WHERE scan_group_id = sg.id) AS works_count
                    FROM scan_group_members sgm
                    JOIN scan_groups sg ON sg.id = sgm.group_id
                    WHERE sgm.user_id = :uid
                    ORDER BY sgm.joined_at DESC
                    """
                ),
                {"uid": user_id},
            )
            return [dict(r) for r in res.mappings().all()]

    async def get_scan_membership(
        self, group_id: int, user_id: int
    ) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ScanGroupMemberORM.role).where(
                    ScanGroupMemberORM.group_id == group_id,
                    ScanGroupMemberORM.user_id == user_id,
                )
            )
            row = res.mappings().first()
            return dict(row) if row else None

    async def update_scan_member_role(
        self, group_id: int, user_id: int, role: str
    ) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(ScanGroupMemberORM)
                .where(
                    ScanGroupMemberORM.group_id == group_id,
                    ScanGroupMemberORM.user_id == user_id,
                )
                .values(role=role)
            )
            await session.commit()

    async def list_missions(self) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(DailyMissionORM).order_by(
                    DailyMissionORM.mission_type.asc(),
                    DailyMissionORM.sort_order.asc(),
                    DailyMissionORM.id.asc(),
                )
            )
            return [m.to_dict() for m in res.scalars().all()]

    async def create_mission(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            mission = DailyMissionORM(
                mission_key=data["mission_key"],
                title=data["title"],
                description=data["description"],
                category=data.get("category", "LECTURA"),
                mission_type=data.get("mission_type", "DAILY"),
                event_name=data.get("event_name"),
                icon=data.get("icon", "book-open"),
                target_count=data.get("target_count", 1),
                condition_type=data.get("condition_type", "CHAPTERS_READ"),
                reward_xp=data.get("reward_xp", 15),
                reward_coins=data.get("reward_coins", 3),
                reward_clan_tokens=data.get("reward_clan_tokens", 0),
                action_url=data.get("action_url", "/pages/catalogo.html"),
                action_text=data.get("action_text", "Explorar obras"),
                sort_order=data.get("sort_order", 0),
                is_active=data.get("is_active", True),
                starts_at=data.get("starts_at"),
                ends_at=data.get("ends_at"),
            )
            session.add(mission)
            await session.commit()
            await session.refresh(mission)
            return mission.to_dict()

    async def update_mission(
        self, mission_id: int, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        if not updates:
            return None
        allowed_cols = {c.name for c in DailyMissionORM.__table__.columns}
        clean_updates = {k: v for k, v in updates.items() if k in allowed_cols}
        async with resolve_session(self.conn) as session:
            if clean_updates:
                await session.execute(
                    update(DailyMissionORM)
                    .where(DailyMissionORM.id == mission_id)
                    .values(**clean_updates)
                )
                await session.commit()
            res = await session.execute(
                select(DailyMissionORM).where(DailyMissionORM.id == mission_id)
            )
            m = res.scalar_one_or_none()
            return m.to_dict() if m else None

    async def delete_mission(self, mission_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                delete(DailyMissionORM).where(DailyMissionORM.id == mission_id)
            )
            await session.commit()
            return (res.rowcount or 0) > 0

    async def log_view(
        self,
        work_id: int,
        chapter_id: int | None,
        user_id: int | None,
        ip_address: str | None,
    ) -> None:
        async with resolve_session(self.conn) as session:
            cutoff_24h = datetime.utcnow() - timedelta(hours=24)

            if user_id:
                if chapter_id:
                    stmt = (
                        select(ViewLogORM.id)
                        .where(
                            ViewLogORM.user_id == user_id,
                            ViewLogORM.work_id == work_id,
                            ViewLogORM.chapter_id == chapter_id,
                        )
                        .limit(1)
                    )
                else:
                    stmt = (
                        select(ViewLogORM.id)
                        .where(
                            ViewLogORM.user_id == user_id,
                            ViewLogORM.work_id == work_id,
                            ViewLogORM.viewed_at >= cutoff_24h,
                        )
                        .limit(1)
                    )
                dup = await session.execute(stmt)
                if dup.scalar_one_or_none() is not None:
                    return
            elif ip_address:
                if chapter_id:
                    stmt = (
                        select(ViewLogORM.id)
                        .where(
                            ViewLogORM.ip_address == ip_address,
                            ViewLogORM.work_id == work_id,
                            ViewLogORM.chapter_id == chapter_id,
                            ViewLogORM.viewed_at >= cutoff_24h,
                        )
                        .limit(1)
                    )
                else:
                    stmt = (
                        select(ViewLogORM.id)
                        .where(
                            ViewLogORM.ip_address == ip_address,
                            ViewLogORM.work_id == work_id,
                            ViewLogORM.viewed_at >= cutoff_24h,
                        )
                        .limit(1)
                    )
                dup = await session.execute(stmt)
                if dup.scalar_one_or_none() is not None:
                    return

            session.add(
                ViewLogORM(
                    work_id=work_id,
                    chapter_id=chapter_id,
                    user_id=user_id,
                    ip_address=ip_address,
                )
            )

            upsert_stmt = (
                pg_insert(WorkStatisticsORM)
                .values(
                    work_id=work_id,
                    total_views=1,
                    daily_views=1,
                    weekly_views=1,
                    monthly_views=1,
                    trending_score=Decimal("1.00"),
                )
                .on_conflict_do_update(
                    index_elements=[WorkStatisticsORM.work_id],
                    set_={
                        "total_views": func.coalesce(WorkStatisticsORM.total_views, 0) + 1,
                        "daily_views": func.coalesce(WorkStatisticsORM.daily_views, 0) + 1,
                        "weekly_views": func.coalesce(WorkStatisticsORM.weekly_views, 0) + 1,
                        "monthly_views": func.coalesce(WorkStatisticsORM.monthly_views, 0) + 1,
                        "trending_score": func.coalesce(
                            WorkStatisticsORM.trending_score, Decimal("0.00")
                        )
                        + Decimal("1.00"),
                    },
                )
            )
            await session.execute(upsert_stmt)
            await session.commit()

    async def has_valid_target(self, work_id: int, chapter_id: int | None) -> bool:
        async with resolve_session(self.conn) as session:
            if chapter_id is None:
                res = await session.execute(
                    select(WorkORM.id).where(WorkORM.id == work_id)
                )
            else:
                res = await session.execute(
                    select(ChapterORM.id).where(
                        ChapterORM.id == chapter_id, ChapterORM.work_id == work_id
                    )
                )
            return res.scalar_one_or_none() is not None

    async def compute_statistics(self) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                text(
                    """
                    INSERT INTO work_statistics (work_id, total_views, daily_views, weekly_views, monthly_views, trending_score)
                    SELECT
                        w.id,
                        COALESCE(SUM(CASE WHEN vl.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_views,
                        COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL '1 day' THEN 1 ELSE 0 END), 0) AS daily_views,
                        COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) AS weekly_views,
                        COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS monthly_views,
                        (
                            COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) * 3.0 +
                            COALESCE(SUM(CASE WHEN vl.id IS NOT NULL THEN 1 ELSE 0 END), 0) * 1.0 +
                            (SELECT COUNT(*) FROM user_library ul WHERE ul.work_id = w.id) * 5.0 +
                            COALESCE((SELECT ROUND(AVG(ul.rating)::numeric, 2) FROM user_library ul WHERE ul.work_id = w.id AND ul.rating IS NOT NULL), 0.0) *
                            (SELECT COUNT(ul.rating) FROM user_library ul WHERE ul.work_id = w.id AND ul.rating IS NOT NULL) * 2.0
                        ) AS trending_score
                    FROM works w
                    LEFT JOIN view_logs vl ON vl.work_id = w.id
                    GROUP BY w.id
                    ON CONFLICT (work_id) DO UPDATE SET
                        total_views = EXCLUDED.total_views,
                        daily_views = EXCLUDED.daily_views,
                        weekly_views = EXCLUDED.weekly_views,
                        monthly_views = EXCLUDED.monthly_views,
                        trending_score = EXCLUDED.trending_score
                    """
                )
            )
            await session.commit()

