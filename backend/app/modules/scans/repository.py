import aiomysql
from typing import Optional, List
from app.core.database import get_db_pool
from app.modules.scans.models import ScanGroup, ScanGroupMember, ScanGroupInvitation
import json

class ScanGroupRepository:
    async def create_group(self, group: ScanGroup) -> ScanGroup:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = "INSERT INTO scan_groups (name, slug, description, logo_url, banner_url) VALUES (%s, %s, %s, %s, %s)"
                await cur.execute(query, (group.name, group.slug, group.description, group.logo_url, group.banner_url))
                group.id = cur.lastrowid
                await conn.commit()
        return group
    
    async def get_group_by_id(self, group_id: int) -> Optional[ScanGroup]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM scan_groups WHERE id = %s", (group_id,))
                row = await cur.fetchone()
                if row:
                    if row['social_links']: row['social_links'] = json.loads(row['social_links'])
                    if row['report_methods']: row['report_methods'] = json.loads(row['report_methods'])
                    return ScanGroup(**row)
        return None

    async def update_group(self, group: ScanGroup) -> ScanGroup:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = """
                    UPDATE scan_groups 
                    SET name = %s, slug = %s, description = %s, logo_url = %s, banner_url = %s, 
                        social_links = %s, report_methods = %s, status = %s
                    WHERE id = %s
                """
                social_json = json.dumps(group.social_links) if group.social_links else None
                report_json = json.dumps(group.report_methods) if group.report_methods else None
                
                await cur.execute(query, (
                    group.name, group.slug, group.description, group.logo_url, group.banner_url,
                    social_json, report_json, group.status, group.id
                ))
                await conn.commit()
        return group

    async def delete_group(self, group_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                # Soft delete
                await cur.execute("UPDATE scan_groups SET status = 'DELETED' WHERE id = %s", (group_id,))
                await conn.commit()
        return True

    async def add_member(self, member: ScanGroupMember):
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                perms_json = json.dumps(member.permissions) if member.permissions else None
                query = "INSERT INTO scan_group_members (group_id, user_id, role, permissions) VALUES (%s, %s, %s, %s)"
                await cur.execute(query, (member.group_id, member.user_id, member.role, perms_json))
                await conn.commit()

    async def get_member(self, group_id: int, user_id: int) -> Optional[ScanGroupMember]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM scan_group_members WHERE group_id = %s AND user_id = %s", (group_id, user_id))
                row = await cur.fetchone()
                if row:
                    if row['permissions']: row['permissions'] = json.loads(row['permissions'])
                    return ScanGroupMember(**row)
        return None

    async def get_group_members(self, group_id: int) -> List[dict]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                SELECT m.group_id, m.user_id, u.username, u.user_code, m.role, m.permissions, m.joined_at 
                FROM scan_group_members m
                JOIN users u ON m.user_id = u.id
                WHERE m.group_id = %s
                """
                await cur.execute(query, (group_id,))
                rows = await cur.fetchall()
                for row in rows:
                    if row['permissions']: row['permissions'] = json.loads(row['permissions'])
                return rows

    async def update_member(self, group_id: int, user_id: int, role: str, permissions: dict):
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                perms_json = json.dumps(permissions) if permissions else None
                await cur.execute("UPDATE scan_group_members SET role = %s, permissions = %s WHERE group_id = %s AND user_id = %s", 
                                  (role, perms_json, group_id, user_id))
                await conn.commit()
    
    async def remove_member(self, group_id: int, user_id: int):
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM scan_group_members WHERE group_id = %s AND user_id = %s", (group_id, user_id))
                await conn.commit()

    async def create_invitation(self, invitation: ScanGroupInvitation) -> ScanGroupInvitation:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = "INSERT INTO scan_group_invitations (group_id, user_id, status, expires_at) VALUES (%s, %s, %s, %s)"
                await cur.execute(query, (invitation.group_id, invitation.user_id, invitation.status, invitation.expires_at))
                invitation.id = cur.lastrowid
                await conn.commit()
        return invitation

    async def get_invitation(self, invite_id: int) -> Optional[dict]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                SELECT i.*, g.name as group_name 
                FROM scan_group_invitations i
                JOIN scan_groups g ON i.group_id = g.id
                WHERE i.id = %s
                """
                await cur.execute(query, (invite_id,))
                return await cur.fetchone()

    async def update_invitation_status(self, invite_id: int, status: str):
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("UPDATE scan_group_invitations SET status = %s WHERE id = %s", (status, invite_id))
                await conn.commit()

    async def get_user_invitations(self, user_id: int) -> List[dict]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                query = """
                SELECT i.*, g.name as group_name 
                FROM scan_group_invitations i
                JOIN scan_groups g ON i.group_id = g.id
                WHERE i.user_id = %s AND i.status = 'PENDING' AND (i.expires_at IS NULL OR i.expires_at > NOW())
                """
                await cur.execute(query, (user_id,))
                return await cur.fetchall()
