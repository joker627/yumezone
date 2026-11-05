from typing import List, Optional

import aiomysql

from app.core.database import resolve_connection
from app.modules.scans.models import (
    ScanGroup,
    ScanGroupMember,
)
from app.utils import parse_json_safe, to_json_safe


class ScanGroupRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    # crear nuevo grupo scan
    async def create_group(self, group: ScanGroup) -> ScanGroup:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO scan_groups (
                        name, slug, description, logo_url, banner_url
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """
                await cur.execute(
                    query,
                    (
                        group.name,
                        group.slug,
                        group.description,
                        group.logo_url,
                        group.banner_url,
                    ),
                )
                group.id = cur.lastrowid
                if self.conn is None:
                    await conn.commit()
        return group

    # obtener grupo scan por id
    async def get_group_by_id(self, group_id: int) -> Optional[ScanGroup]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT * FROM scan_groups WHERE id = %s",
                    (group_id,),
                )
                row = await cur.fetchone()
                if row:
                    row["social_links"] = parse_json_safe(row.get("social_links"), {})
                    row["report_methods"] = parse_json_safe(row.get("report_methods"), {})
                    return ScanGroup(**row)
        return None

    # actualizar informacion del grupo scan
    async def update_group(self, group: ScanGroup) -> ScanGroup:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    UPDATE scan_groups
                    SET name = %s,
                        slug = %s,
                        description = %s,
                        logo_url = %s,
                        banner_url = %s,
                        social_links = %s,
                        report_methods = %s,
                        status = %s
                    WHERE id = %s
                """
                social_json = (
                    to_json_safe(group.social_links) if group.social_links else None
                )
                report_json = (
                    to_json_safe(group.report_methods) if group.report_methods else None
                )

                await cur.execute(
                    query,
                    (
                        group.name,
                        group.slug,
                        group.description,
                        group.logo_url,
                        group.banner_url,
                        social_json,
                        report_json,
                        group.status,
                        group.id,
                    ),
                )
                if self.conn is None:
                    await conn.commit()
        return group

    # marcar grupo scan como eliminado
    async def delete_group(self, group_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE scan_groups SET status = 'DELETED' WHERE id = %s",
                    (group_id,),
                )
                if self.conn is None:
                    await conn.commit()
        return True

    # anadir miembro a grupo scan
    async def add_member(self, member: ScanGroupMember):
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                perms_json = (
                    to_json_safe(member.permissions) if member.permissions else None
                )
                query = """
                    INSERT INTO scan_group_members (
                        group_id, user_id, role, permissions
                    )
                    VALUES (%s, %s, %s, %s)
                """
                await cur.execute(
                    query,
                    (
                        member.group_id,
                        member.user_id,
                        member.role,
                        perms_json,
                    ),
                )
                if self.conn is None:
                    await conn.commit()

    # obtener miembro especifico de un grupo
    async def get_member(
        self, group_id: int, user_id: int
    ) -> Optional[ScanGroupMember]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT * FROM scan_group_members "
                    "WHERE group_id = %s AND user_id = %s",
                    (group_id, user_id),
                )
                row = await cur.fetchone()
                if row:
                    row["permissions"] = parse_json_safe(row.get("permissions"), {})
                    return ScanGroupMember(**row)
        return None

    # listar todos los miembros de un grupo scan
    async def get_group_members(self, group_id: int) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                    SELECT
                        m.group_id,
                        m.user_id,
                        u.username,
                        u.user_code,
                        m.role,
                        m.permissions,
                        m.joined_at
                    FROM scan_group_members m
                    JOIN users u ON m.user_id = u.id
                    WHERE m.group_id = %s
                """
                await cur.execute(query, (group_id,))
                rows = await cur.fetchall()
                for row in rows:
                    row["permissions"] = parse_json_safe(row.get("permissions"), {})
                return rows

    # actualizar rol y permisos de un miembro
    async def update_member(
        self,
        group_id: int,
        user_id: int,
        role: str,
        permissions: dict,
    ):
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                perms_json = to_json_safe(permissions) if permissions else None
                await cur.execute(
                    "UPDATE scan_group_members "
                    "SET role = %s, permissions = %s "
                    "WHERE group_id = %s AND user_id = %s",
                    (role, perms_json, group_id, user_id),
                )
                if self.conn is None:
                    await conn.commit()

    # remover miembro de un grupo scan
    async def remove_member(self, group_id: int, user_id: int):
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM scan_group_members "
                    "WHERE group_id = %s AND user_id = %s",
                    (group_id, user_id),
                )
                if self.conn is None:
                    await conn.commit()

    # Listar scans publicos con estadisticas agregadas
    async def get_public_scans_list(self) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                    SELECT
                        sg.id,
                        sg.name,
                        sg.slug,
                        sg.logo_url,
                        sg.banner_url,
                        sg.description,
                        sg.social_links,
                        sg.report_methods,
                        sg.status,
                        sg.created_at,
                        COALESCE(w_count.works_count, 0) AS works_count,
                        COALESCE(c_count.chapters_count, 0) AS chapters_count,
                        COALESCE(m_count.members_count, 0) AS members_count,
                        u.username AS owner_username,
                        u.avatar_url AS owner_avatar_url
                    FROM scan_groups sg
                    LEFT JOIN users u ON sg.owner_user_id = u.id
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS works_count
                        FROM works
                        WHERE scan_group_id IS NOT NULL
                        GROUP BY scan_group_id
                    ) w_count ON sg.id = w_count.scan_group_id
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS chapters_count
                        FROM chapters
                        WHERE scan_group_id IS NOT NULL
                        GROUP BY scan_group_id
                    ) c_count ON sg.id = c_count.scan_group_id
                    LEFT JOIN (
                        SELECT group_id, COUNT(*) AS members_count
                        FROM scan_group_members
                        GROUP BY group_id
                    ) m_count ON sg.id = m_count.group_id
                    WHERE sg.status = 'ACTIVE'
                    ORDER BY chapters_count DESC, works_count DESC
                """
                await cur.execute(query)
                rows = await cur.fetchall()
                for r in rows:
                    r["social_links"] = parse_json_safe(r.get("social_links"), {})
                    r["report_methods"] = parse_json_safe(r.get("report_methods"), {})
                return rows

    # Obtener detalle publico de un scan por slug
    async def get_public_scan_by_slug(self, slug: str) -> Optional[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                    SELECT
                        sg.id,
                        sg.name,
                        sg.slug,
                        sg.logo_url,
                        sg.banner_url,
                        sg.description,
                        sg.social_links,
                        sg.report_methods,
                        sg.status,
                        sg.created_at,
                        (SELECT COUNT(*) FROM works WHERE scan_group_id = sg.id) AS works_count,
                        (SELECT COUNT(*) FROM chapters WHERE scan_group_id = sg.id) AS chapters_count,
                        (SELECT COUNT(*) FROM scan_group_members WHERE group_id = sg.id) AS members_count,
                        u.username AS owner_username,
                        u.avatar_url AS owner_avatar_url
                    FROM scan_groups sg
                    LEFT JOIN users u ON sg.owner_user_id = u.id
                    WHERE sg.slug = %s AND sg.status = 'ACTIVE'
                """
                await cur.execute(query, (slug,))
                row = await cur.fetchone()
                if not row:
                    return None
                row["social_links"] = parse_json_safe(row.get("social_links"), {})
                row["report_methods"] = parse_json_safe(row.get("report_methods"), {})
                return row

    # Obtener todas las funciones/roles reales de scan desde la BD
    async def get_all_roles(self) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT id, code, name FROM scan_roles ORDER BY id ASC")
                return await cur.fetchall()

    # Obtener obras de un scan especifico
    async def get_scan_works(self, scan_group_id: int) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                    SELECT
                        w.id,
                        w.title,
                        w.slug,
                        w.cover_url,
                        w.synopsis,
                        COALESCE(s.name, 'En emisión') AS status,
                        COALESCE(f.name, 'Manga') AS format,
                        COALESCE(ws.rating_average, 0.0) AS score,
                        COALESCE(c_count.chapters_count, 0) AS chapters_count
                    FROM works w
                    LEFT JOIN statuses s ON w.status_id = s.id
                    LEFT JOIN formats f ON w.format_id = f.id
                    LEFT JOIN work_statistics ws ON w.id = ws.work_id
                    LEFT JOIN (
                        SELECT work_id, COUNT(*) AS chapters_count
                        FROM chapters
                        GROUP BY work_id
                    ) c_count ON w.id = c_count.work_id
                    WHERE w.scan_group_id = %s
                    ORDER BY score DESC, chapters_count DESC
                """
                await cur.execute(query, (scan_group_id,))
                return await cur.fetchall()

    # Obtener miembros publicos de un scan con sus roles reales desde scan_roles
    async def get_public_scan_members(self, scan_group_id: int) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                    SELECT
                        m.user_id,
                        u.username,
                        u.user_code,
                        u.avatar_url,
                        m.role AS role_code,
                        COALESCE(sr.name, m.role) AS role_name,
                        m.joined_at
                    FROM scan_group_members m
                    JOIN users u ON m.user_id = u.id
                    LEFT JOIN scan_roles sr ON m.role = sr.code
                    WHERE m.group_id = %s
                    ORDER BY COALESCE(sr.id, 99) ASC, m.joined_at ASC
                """
                await cur.execute(query, (scan_group_id,))
                return await cur.fetchall()

    # Obtener el scan al que pertenece un usuario logueado con rol real
    async def get_user_scan(self, user_id: int) -> Optional[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                    SELECT
                        sg.id,
                        sg.name,
                        sg.slug,
                        sg.logo_url,
                        sg.banner_url,
                        sg.description,
                        m.role AS role_code,
                        COALESCE(sr.name, m.role) AS role_name,
                        m.joined_at,
                        COALESCE(w_count.works_count, 0) AS works_count,
                        COALESCE(c_count.chapters_count, 0) AS chapters_count
                    FROM scan_group_members m
                    JOIN scan_groups sg ON m.group_id = sg.id
                    LEFT JOIN scan_roles sr ON m.role = sr.code
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS works_count FROM works GROUP BY scan_group_id
                    ) w_count ON sg.id = w_count.scan_group_id
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS chapters_count FROM chapters GROUP BY scan_group_id
                    ) c_count ON sg.id = c_count.scan_group_id
                    WHERE m.user_id = %s AND sg.status = 'ACTIVE'
                    LIMIT 1
                """
                await cur.execute(query, (user_id,))
                return await cur.fetchone()

