from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
import aiomysql

from app.core.database import resolve_connection
from app.utils import parse_json_safe, to_json_safe


class AdminRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    @asynccontextmanager
    async def _cursor(self, cursor_cls=None) -> AsyncGenerator[Tuple[aiomysql.Connection, aiomysql.Cursor], None]:
        async with resolve_connection(self.conn) as conn:
            if cursor_cls:
                async with conn.cursor(cursor_cls) as cur:
                    yield conn, cur
            else:
                async with conn.cursor() as cur:
                    yield conn, cur

    async def _commit_if_needed(self, conn: aiomysql.Connection) -> None:
        if self.conn is None:
            await conn.commit()

    async def log_audit(
        self,
        actor_id: int,
        action: str,
        entity_type: str,
        entity_id: str,
        before: object = None,
        after: object = None,
    ) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                INSERT INTO audit_logs
                  (actor_user_id, action, entity_type, entity_id, before_data, after_data)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    to_json_safe(before) if before is not None else None,
                    to_json_safe(after) if after is not None else None,
                ),
            )
            await self._commit_if_needed(conn)

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
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
            stats = await cur.fetchone() or {}

            await cur.execute(
                """
                SELECT w.id, w.title, w.slug, w.cover_url, COALESCE(s.name, 'En emisión') AS status, w.created_at
                FROM works w
                LEFT JOIN statuses s ON s.id = w.status_id
                ORDER BY w.created_at DESC LIMIT 5
                """
            )
            recent_works = await cur.fetchall() or []

            await cur.execute(
                """
                SELECT cr.id, cr.entity_type, cr.reason, cr.status, cr.created_at, u.username AS reporter_username
                FROM content_reports cr
                JOIN users u ON u.id = cr.reporter_user_id
                WHERE cr.status IN ('OPEN', 'REVIEWING')
                ORDER BY cr.created_at DESC LIMIT 4
                """
            )
            recent_reports = await cur.fetchall() or []

            await cur.execute(
                """
                SELECT al.id, al.action, al.entity_type, al.entity_id, al.created_at, u.username AS actor_username
                FROM audit_logs al
                LEFT JOIN users u ON u.id = al.actor_user_id
                ORDER BY al.created_at DESC LIMIT 6
                """
            )
            recent_audit = await cur.fetchall() or []

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
        params: list[object] = []
        where = ""
        if q:
            where = "WHERE username LIKE %s OR email LIKE %s OR user_code LIKE %s"
            term = f"%{q.strip()}%"
            params.extend([term, term, term])
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
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
            rows = await cur.fetchall() or []
            return {"data": rows, "page": page, "per_page": per_page, "total": total}

    async def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute("SELECT id, status, platform_role FROM users WHERE id = %s", (user_id,))
            return await cur.fetchone()

    async def update_user_status(self, user_id: int, status: str) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute("UPDATE users SET status = %s WHERE id = %s", (status, user_id))
            await self._commit_if_needed(conn)

    async def update_user_role(self, user_id: int, role: str) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute("UPDATE users SET platform_role = %s WHERE id = %s", (role, user_id))
            await self._commit_if_needed(conn)

    async def list_settings(self) -> List[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute("SELECT setting_key, setting_value, description FROM platform_settings ORDER BY setting_key")
            rows = await cur.fetchall() or []
            for r in rows:
                r["setting_value"] = parse_json_safe(r.get("setting_value"), default=r.get("setting_value"))
            return rows

    async def get_setting(self, setting_key: str) -> Optional[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                "SELECT setting_key, setting_value, description FROM platform_settings WHERE setting_key = %s",
                (setting_key,),
            )
            row = await cur.fetchone()
            if row:
                row["setting_value"] = parse_json_safe(row.get("setting_value"), default=row.get("setting_value"))
            return row

    async def update_setting(self, setting_key: str, value: Any, description: Optional[str] = None) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                INSERT INTO platform_settings (setting_key, setting_value, description)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description)
                """,
                (setting_key, to_json_safe(value), description),
            )
            await self._commit_if_needed(conn)

    async def list_audit_logs(self, limit: int) -> List[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                """
                SELECT al.*, u.username AS actor_username
                FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
                ORDER BY al.created_at DESC LIMIT %s
                """,
                (limit,),
            )
            rows = await cur.fetchall() or []
            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()
            return rows

    async def list_reports(self, status: Optional[str], limit: int) -> List[Dict[str, Any]]:
        where = "WHERE cr.status = %s" if status else ""
        params = (status, limit) if status else (limit,)
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                f"""
                SELECT cr.*, u.username AS reporter_username
                FROM content_reports cr JOIN users u ON u.id = cr.reporter_user_id
                {where}
                ORDER BY cr.created_at DESC LIMIT %s
                """,
                params,
            )
            rows = await cur.fetchall() or []
            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()
            return rows

    async def get_report_by_id(self, report_id: int) -> Optional[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute("SELECT * FROM content_reports WHERE id = %s", (report_id,))
            return await cur.fetchone()

    async def update_report(self, report_id: int, status: str, reviewer_id: int) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                UPDATE content_reports
                SET status = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (status, reviewer_id, report_id),
            )
            await self._commit_if_needed(conn)

    async def list_announcements(self, limit: int = 100) -> List[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute("SELECT * FROM announcements ORDER BY created_at DESC LIMIT %s", (limit,))
            return await cur.fetchall() or []

    async def create_announcement(
        self, type: str, type_label: str, source: str, title: str, description: Optional[str]
    ) -> int:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                INSERT INTO announcements (type, type_label, source, title, description, is_active)
                VALUES (%s, %s, %s, %s, %s, TRUE)
                """,
                (type, type_label, source, title, description),
            )
            last_id = cur.lastrowid
            await self._commit_if_needed(conn)
            return last_id

    async def delete_announcement(self, announcement_id: int) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute("DELETE FROM announcements WHERE id = %s", (announcement_id,))
            await self._commit_if_needed(conn)

    async def list_works(self, q: Optional[str], limit: int, offset: int) -> List[Dict[str, Any]]:
        where = "WHERE w.title LIKE %s OR w.slug LIKE %s" if q else ""
        params = (f"%{q.strip()}%", f"%{q.strip()}%", limit, offset) if q else (limit, offset)
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                f"""
                SELECT w.id, w.title, w.slug, w.cover_url, w.status_id, w.scan_group_id,
                       s.name AS status_name, sg.name AS scan_group_name,
                       COALESCE(ws.chapters_count, 0) AS chapters_count
                FROM works w
                LEFT JOIN work_statistics ws ON ws.work_id = w.id
                LEFT JOIN statuses s ON s.id = w.status_id
                LEFT JOIN scan_groups sg ON sg.id = w.scan_group_id
                {where}
                ORDER BY w.updated_at DESC LIMIT %s OFFSET %s
                """,
                params,
            )
            return await cur.fetchall() or []

    async def update_work(self, work_id: int, updates: Dict[str, Any]) -> None:
        clauses = [f"{k} = %s" for k in updates.keys()]
        vals = list(updates.values()) + [work_id]
        async with self._cursor() as (conn, cur):
            await cur.execute(f"UPDATE works SET {', '.join(clauses)} WHERE id = %s", tuple(vals))
            await self._commit_if_needed(conn)

    async def list_comments(self, limit: int = 50) -> List[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
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
            return await cur.fetchall() or []

    async def moderate_delete_comment(self, comment_id: int) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                "UPDATE comments SET status = 'DELETED', content = '[Comentario moderado por la Administración]' WHERE id = %s",
                (comment_id,),
            )
            await self._commit_if_needed(conn)

    async def list_scan_groups(self) -> List[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
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
            return await cur.fetchall() or []

    async def list_user_scan_groups(self, user_id: int) -> List[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                """
                SELECT sg.id, sg.name, sg.slug, sg.logo_url, sgm.role, sgm.joined_at,
                       (SELECT COUNT(*) FROM works WHERE scan_group_id = sg.id) AS works_count
                FROM scan_group_members sgm
                JOIN scan_groups sg ON sg.id = sgm.group_id
                WHERE sgm.user_id = %s
                ORDER BY sgm.joined_at DESC
                """,
                (user_id,),
            )
            return await cur.fetchall() or []

    async def get_scan_membership(self, group_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                "SELECT role FROM scan_group_members WHERE group_id = %s AND user_id = %s",
                (group_id, user_id),
            )
            return await cur.fetchone()

    async def update_scan_member_role(self, group_id: int, user_id: int, role: str) -> None:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                "UPDATE scan_group_members SET role = %s WHERE group_id = %s AND user_id = %s",
                (role, group_id, user_id),
            )
            await self._commit_if_needed(conn)
