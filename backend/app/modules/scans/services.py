from typing import List
from fastapi import HTTPException

from app.modules.scans.models import (
    ScanGroup,
    ScanGroupMember,
)
from app.modules.scans.repository import ScanGroupRepository
from app.modules.scans.schemas import (
    ScanGroupCreate,
    UpdateMemberPermissions,
)
from app.modules.users.models import CurrentUser
from app.utils.generate_slug import generate_slug


class ScanGroupService:
    def __init__(self):
        self.repository = ScanGroupRepository()

    async def create_group(
        self, user: CurrentUser, group_data: ScanGroupCreate
    ) -> ScanGroup:
        slug = generate_slug(group_data.name)
        new_group = ScanGroup(
            name=group_data.name,
            slug=slug,
            description=group_data.description,
            logo_url=group_data.logo_url,
            banner_url=group_data.banner_url,
        )

        try:
            created_group = await self.repository.create_group(new_group)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="El nombre del grupo ya existe o es inválido.",
            )

        if created_group.id is None or user.id is None:
            raise HTTPException(
                status_code=500,
                detail="Error inesperado al crear el grupo.",
            )

        leader = ScanGroupMember(
            group_id=created_group.id,
            user_id=user.id,
            role="ADMIN",
            permissions={
                "can_upload": True,
                "can_edit_group": True,
                "can_manage_members": True,
            },
        )
        await self.repository.add_member(leader)

        return created_group

    async def get_group_by_id(self, group_id: int) -> ScanGroup:
        group = await self.repository.get_group_by_id(group_id)
        if not group:
            raise HTTPException(
                status_code=404,
                detail="Grupo no encontrado.",
            )
        return group

    async def update_group(self, group_id: int, group_data: dict) -> ScanGroup:
        group = await self.get_group_by_id(group_id)

        for key, value in group_data.items():
            if hasattr(group, key) and value is not None:
                setattr(group, key, value)

        if "name" in group_data and group_data["name"]:
            new_slug = generate_slug(group_data["name"])
            group.slug = new_slug

        try:
            updated_group = await self.repository.update_group(group)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="El nombre del grupo ya existe o es inválido.",
            )

        return updated_group

    async def delete_group(self, group_id: int) -> bool:
        await self.get_group_by_id(group_id)
        return await self.repository.delete_group(group_id)

    async def get_group_members(self, group_id: int) -> List[dict]:
        return await self.repository.get_group_members(group_id)

    async def update_member_permissions(
        self,
        group_id: int,
        updater_id: int,
        target_user_id: int,
        updates: UpdateMemberPermissions,
    ):
        if updater_id == target_user_id:
            raise HTTPException(
                status_code=400,
                detail=("No puedes modificar tus propios permisos " "de esta forma."),
            )

        target_member = await self.repository.get_member(group_id, target_user_id)
        if not target_member:
            raise HTTPException(
                status_code=404,
                detail="Miembro no encontrado.",
            )

        updater = await self.repository.get_member(group_id, updater_id)
        if not updater:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos en este grupo.",
            )

        privileged_roles = ("MODERATOR", "ADMIN")
        if updater.role == "MODERATOR" and target_member.role in privileged_roles:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para modificar a este usuario.",
            )

        new_role = updates.role if updates.role else target_member.role
        new_perms = updates.permissions or target_member.permissions or {}

        await self.repository.update_member(
            group_id, target_user_id, new_role, new_perms
        )
        return {"message": "Permisos actualizados correctamente."}

    async def kick_member(
        self,
        group_id: int,
        updater_id: int,
        target_user_id: int,
    ):
        if updater_id == target_user_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Usa la opción de abandonar el grupo " "en lugar de expulsarte."
                ),
            )

        target_member = await self.repository.get_member(group_id, target_user_id)
        if not target_member:
            raise HTTPException(
                status_code=404,
                detail="Miembro no encontrado.",
            )

        updater = await self.repository.get_member(group_id, updater_id)
        if not updater:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos en este grupo.",
            )

        privileged_roles = ("MODERATOR", "ADMIN")
        if updater.role == "MODERATOR" and target_member.role in privileged_roles:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para expulsar a este usuario.",
            )

        await self.repository.remove_member(group_id, target_user_id)
        return {"message": "Usuario expulsado del grupo."}
