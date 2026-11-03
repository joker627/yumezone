import asyncio
from typing import Any, List, Optional, Union
from fastapi import HTTPException, status

from app.core.dependencies import is_platform_admin
from app.core.redis import cached_query
from app.modules.scans.models import ScanGroup, ScanGroupMember
from app.modules.scans.repository import ScanGroupRepository
from app.modules.scans.schemas import ScanGroupCreate, UpdateMemberPermissions
from app.modules.users.models import CurrentUser
from app.utils import generate_slug


class ScanGroupService:
    def __init__(self, conn: Optional[Any] = None):
        self.repository = ScanGroupRepository(conn)

    async def create_group(self, user: CurrentUser, group_data: ScanGroupCreate) -> ScanGroup:
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
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre del grupo ya existe o es inválido.",
            )

        if created_group.id is None or user.id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error inesperado al crear el grupo.",
            )

        leader = ScanGroupMember(
            group_id=created_group.id,
            user_id=user.id,
            role="LEADER",
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
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grupo no encontrado.",
            )
        return group

    async def update_group(self, group_id: int, group_data: dict) -> ScanGroup:
        group = await self.get_group_by_id(group_id)

        for key, value in group_data.items():
            if hasattr(group, key) and value is not None:
                setattr(group, key, value)

        if "name" in group_data and group_data["name"]:
            group.slug = generate_slug(group_data["name"])

        try:
            return await self.repository.update_group(group)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre del grupo ya existe o es inválido.",
            )

    async def delete_group(self, group_id: int) -> bool:
        await self.get_group_by_id(group_id)
        return await self.repository.delete_group(group_id)

    async def get_group_members(self, group_id: int) -> List[dict]:
        return await self.repository.get_group_members(group_id)

    async def update_member_permissions(
        self,
        group_id: int,
        updater: Union[CurrentUser, int],
        target_user_id: int,
        updates: UpdateMemberPermissions,
    ) -> dict:
        updater_id = updater.id if isinstance(updater, CurrentUser) else updater
        is_admin = is_platform_admin(updater) if isinstance(updater, CurrentUser) else False

        if updater_id == target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes modificar tus propios permisos.",
            )

        target_member = await self.repository.get_member(group_id, target_user_id)
        if not target_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Miembro no encontrado en el grupo.",
            )

        if not is_admin:
            updater_member = await self.repository.get_member(group_id, updater_id)
            if not updater_member or not updater_member.can_manage:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tienes permisos de administración en este grupo.",
                )
            if target_member.is_leader:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo el líder o un administrador de plataforma pueden alterar la cuenta del líder.",
                )
            if not updater_member.is_leader:
                if target_member.can_manage:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="No puedes modificar los permisos de otro administrador del grupo.",
                    )
                if updates.role and updates.role.upper() in ("LEADER", "CO_LEADER"):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Solo el líder puede nombrar nuevos líderes o colíderes.",
                    )

        new_role = target_member.role
        if updates.role:
            role_candidate = updates.role.upper()
            db_roles = await self.get_all_roles()
            valid_role_codes = [r["code"] for r in db_roles]
            if role_candidate not in valid_role_codes:
                valid_names = [f"{r.get('name', r['code'])} ({r['code']})" for r in db_roles]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Rol no válido. Permitidos: {', '.join(valid_names)}",
                )
            new_role = role_candidate

        new_perms = updates.permissions or target_member.permissions or {}
        await self.repository.update_member(group_id, target_user_id, new_role, new_perms)
        return {"message": "Permisos actualizados correctamente."}

    async def kick_member(
        self,
        group_id: int,
        updater: Union[CurrentUser, int],
        target_user_id: int,
    ) -> dict:
        updater_id = updater.id if isinstance(updater, CurrentUser) else updater
        is_admin = is_platform_admin(updater) if isinstance(updater, CurrentUser) else False

        if updater_id == target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usa la opción de abandonar el grupo en lugar de expulsarte.",
            )

        target_member = await self.repository.get_member(group_id, target_user_id)
        if not target_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Miembro no encontrado en el grupo.",
            )

        if not is_admin:
            updater_member = await self.repository.get_member(group_id, updater_id)
            if not updater_member or not updater_member.can_manage:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tienes permisos de administración en este grupo.",
                )
            if target_member.is_leader:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No se puede expulsar al líder del grupo.",
                )
            if not updater_member.is_leader and target_member.can_manage:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No puedes expulsar a otro administrador del grupo.",
                )

        await self.repository.remove_member(group_id, target_user_id)
        return {"message": "Usuario expulsado del grupo."}

    async def get_public_scans(self) -> List[dict]:
        return await cached_query(
            "yume:cache:scans:public:list",
            self.repository.get_public_scans_list,
            ttl=60,
        )

    async def get_all_roles(self) -> List[dict]:
        return await cached_query(
            "yume:cache:scans:roles",
            self.repository.get_all_roles,
            ttl=300,
        )

    async def get_public_scan_detail(self, slug: str) -> dict:
        scan = await self.repository.get_public_scan_by_slug(slug)
        if not scan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clan o Scan no encontrado.",
            )
        if self.repository.conn is None:
            works, members = await asyncio.gather(
                self.repository.get_scan_works(scan["id"]),
                self.repository.get_public_scan_members(scan["id"]),
            )
        else:
            works = await self.repository.get_scan_works(scan["id"])
            members = await self.repository.get_public_scan_members(scan["id"])
        scan["works"] = works
        scan["members"] = members
        return scan

    async def get_user_scan(self, user_id: int) -> Optional[dict]:
        return await self.repository.get_user_scan(user_id)
