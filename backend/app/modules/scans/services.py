from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from app.modules.scans.repository import ScanGroupRepository
from app.modules.scans.models import ScanGroup, ScanGroupMember, ScanGroupInvitation
from app.modules.scans.schemas import ScanGroupCreate, UpdateMemberPermissions
from app.modules.users.models import User
import aiomysql
from app.core.database import get_db_pool
from app.utils.generate_slug import generate_slug

class ScanGroupService:
    def __init__(self):
        self.repository = ScanGroupRepository()

    async def create_group(self, user: User, group_data: ScanGroupCreate) -> ScanGroup:
        slug = generate_slug(group_data.name)
        new_group = ScanGroup(
            name=group_data.name,
            slug=slug,
            description=group_data.description,
            logo_url=group_data.logo_url,
            banner_url=group_data.banner_url
        )
        
        try:
            created_group = await self.repository.create_group(new_group)
        except Exception as e:
            # Catch integrity errors (e.g., duplicate name)
            raise HTTPException(status_code=400, detail="El nombre del grupo ya existe o es inválido.")
        
        # Add creator as ADMIN
        leader = ScanGroupMember(
            group_id=created_group.id,
            user_id=user.id,
            role='ADMIN',
            permissions={"can_upload": True, "can_edit_group": True, "can_manage_members": True}
        )
        await self.repository.add_member(leader)
        
        return created_group

    async def get_group_by_id(self, group_id: int) -> ScanGroup:
        group = await self.repository.get_group_by_id(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        return group

    async def update_group(self, group_id: int, group_data: dict) -> ScanGroup:
        group = await self.get_group_by_id(group_id)
        
        for key, value in group_data.items():
            if hasattr(group, key) and value is not None:
                setattr(group, key, value)
                
        if 'name' in group_data and group_data['name']:
            new_slug = generate_slug(group_data['name'])
            # Here we might need to check for existing slug, but let's rely on DB UNIQUE constraint for simplicity,
            # or we could implement a check. For now, rely on DB.
            group.slug = new_slug
            
        try:
            updated_group = await self.repository.update_group(group)
        except Exception:
            raise HTTPException(status_code=400, detail="El nombre del grupo ya existe o es inválido.")
            
        return updated_group

    async def delete_group(self, group_id: int) -> bool:
        group = await self.get_group_by_id(group_id)
        return await self.repository.delete_group(group_id)

    async def get_group_members(self, group_id: int) -> List[dict]:
        return await self.repository.get_group_members(group_id)

    async def _get_user_by_code(self, user_code: str) -> Optional[int]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT id FROM users WHERE user_code = %s", (user_code,))
                row = await cur.fetchone()
                return row['id'] if row else None

    async def invite_user(self, group_id: int, inviter: User, user_code: str) -> ScanGroupInvitation:
        # Verify inviter is ADMIN or LEADER (done in router via dependency, but good to check)
        
        user_id = await self._get_user_by_code(user_code)
        if not user_id:
            raise HTTPException(status_code=404, detail="Usuario no encontrado con ese código.")
            
        if user_id == inviter.id:
            raise HTTPException(status_code=400, detail="No puedes invitarte a ti mismo.")

        # Check if already member
        existing_member = await self.repository.get_member(group_id, user_id)
        if existing_member:
            raise HTTPException(status_code=400, detail="El usuario ya es miembro de este grupo.")

        # Check if pending invite exists
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT id FROM scan_group_invitations WHERE group_id = %s AND user_id = %s AND status = 'PENDING' AND (expires_at IS NULL OR expires_at > NOW())", (group_id, user_id))
                if await cur.fetchone():
                    raise HTTPException(status_code=400, detail="El usuario ya tiene una invitación pendiente.")

        invitation = ScanGroupInvitation(
            group_id=group_id,
            user_id=user_id,
            status='PENDING',
            expires_at=datetime.utcnow() + timedelta(days=7) # 7 days expiration
        )
        return await self.repository.create_invitation(invitation)

    async def get_my_invitations(self, user_id: int) -> List[dict]:
        return await self.repository.get_user_invitations(user_id)

    async def respond_invitation(self, invite_id: int, user_id: int, accept: bool):
        invitation = await self.repository.get_invitation(invite_id)
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitación no encontrada.")
            
        if invitation['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="No tienes permiso para responder a esta invitación.")
            
        if invitation['status'] != 'PENDING':
            raise HTTPException(status_code=400, detail="La invitación ya fue respondida.")
            
        if invitation['expires_at'] and invitation['expires_at'] < datetime.utcnow():
            await self.repository.update_invitation_status(invite_id, 'REJECTED')
            raise HTTPException(status_code=400, detail="La invitación ha expirado.")

        if accept:
            await self.repository.update_invitation_status(invite_id, 'ACCEPTED')
            # Add as MEMBER by default with read only permissions technically, or can_upload: False
            member = ScanGroupMember(
                group_id=invitation['group_id'],
                user_id=user_id,
                role='MEMBER',
                permissions={"can_upload": False}
            )
            await self.repository.add_member(member)
            return {"message": "Invitación aceptada. Ahora eres miembro del grupo."}
        else:
            await self.repository.update_invitation_status(invite_id, 'REJECTED')
            return {"message": "Invitación rechazada."}

    async def update_member_permissions(self, group_id: int, updater_id: int, target_user_id: int, updates: UpdateMemberPermissions):
        if updater_id == target_user_id:
            raise HTTPException(status_code=400, detail="No puedes modificar tus propios permisos de esta forma.")
            
        target_member = await self.repository.get_member(group_id, target_user_id)
        if not target_member:
            raise HTTPException(status_code=404, detail="Miembro no encontrado.")

        updater = await self.repository.get_member(group_id, updater_id)
        
        # ADMIN can modify anyone. MODERATOR can modify MEMBER. 
        if updater.role == 'MODERATOR' and target_member.role in ['MODERATOR', 'ADMIN']:
            raise HTTPException(status_code=403, detail="No tienes permisos para modificar a este usuario.")

        new_role = updates.role if updates.role else target_member.role
        new_perms = updates.permissions if updates.permissions else target_member.permissions

        await self.repository.update_member(group_id, target_user_id, new_role, new_perms)
        return {"message": "Permisos actualizados correctamente."}

    async def kick_member(self, group_id: int, updater_id: int, target_user_id: int):
        if updater_id == target_user_id:
            raise HTTPException(status_code=400, detail="Usa la opción de abandonar el grupo en lugar de expulsarte.")
            
        target_member = await self.repository.get_member(group_id, target_user_id)
        if not target_member:
            raise HTTPException(status_code=404, detail="Miembro no encontrado.")

        updater = await self.repository.get_member(group_id, updater_id)
        
        # ADMIN can kick anyone. MODERATOR can kick MEMBER. 
        if updater.role == 'MODERATOR' and target_member.role in ['MODERATOR', 'ADMIN']:
            raise HTTPException(status_code=403, detail="No tienes permisos para expulsar a este usuario.")

        await self.repository.remove_member(group_id, target_user_id)
        return {"message": "Usuario expulsado del grupo."}
