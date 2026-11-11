import asyncio
from typing import Any, List, Optional, Union
from fastapi import HTTPException, status

from app.core.database import resolve_session
from app.core.dependencies import is_platform_admin
from app.core.redis import cached_query, get_redis_client
from app.modules.notifications.models import NotificationORM
from app.modules.scans.repository import ScanGroupRepository
from app.modules.scans.schemas import ScanGroup, ScanGroupMember, ScanGroupCreate, UpdateMemberPermissions, AddMemberRequest, JoinScanRequest
from app.modules.users.schemas import CurrentUser
from app.utils.formatters import generate_slug


class ScanGroupService:
    def __init__(self, conn: Optional[Any] = None):
        self.repository = ScanGroupRepository(conn)

    async def _invalidate_public_cache(self) -> None:
        client = get_redis_client()
        if client:
            try:
                await client.delete("yume:cache:scans:public:list")
            except Exception:
                pass

    async def create_group(self, user: CurrentUser, group_data: ScanGroupCreate) -> ScanGroup:
        if not is_platform_admin(user) and str(user.platform_role or "").upper() != "SCAN_VERIFIED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo usuarios con verificación de Scan (SCAN_VERIFIED) o Administradores pueden fundar un nuevo Scan.",
            )

        existing_membership = await self.repository.get_user_membership(user.id)
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya perteneces al scan '{existing_membership.get('group_name')}'. No puedes fundar otro sin salir primero.",
            )

        slug = generate_slug(group_data.name)
        new_group = ScanGroup(
            name=group_data.name,
            slug=slug,
            description=group_data.description,
            logo_url=group_data.logo_url,
            banner_url=group_data.banner_url,
        )

        try:
            created_group = await self.repository.create_group(new_group, owner_user_id=user.id)
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

    async def add_member_by_identifier(
        self,
        group_id: int,
        creator: Union[CurrentUser, int],
        payload: AddMemberRequest,
    ) -> dict:
        creator_id = creator.id if isinstance(creator, CurrentUser) else creator
        is_admin = is_platform_admin(creator) if isinstance(creator, CurrentUser) else False

        # 1. Verificar permisos de administración del creador
        if not is_admin:
            member = await self.repository.get_member(group_id, creator_id)
            if not member or not member.can_manage:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tienes permisos de administración en este clan.",
                )

        # 2. Buscar usuario destino
        target_user = await self.repository.find_user_by_identifier(payload.user_identifier)
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró ningún usuario con ese username, código o correo.",
            )

        target_user_id = target_user["id"]

        # 3. Verificar que no esté ya en este scan
        existing_in_group = await self.repository.get_member(group_id, target_user_id)
        if existing_in_group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El usuario @{target_user['username']} ya es miembro de este clan.",
            )

        # 4. Verificar que no pertenezca a otro scan activo
        other_membership = await self.repository.get_user_membership(target_user_id)
        if other_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El usuario @{target_user['username']} ya pertenece al clan '{other_membership.get('group_name')}'.",
            )

        # 5. Validar rol solicitado
        role = payload.role.upper()
        if role == "LEADER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede agregar a un usuario como Líder directamente.",
            )
        db_roles = await self.get_all_roles()
        valid_role_codes = [r["code"] for r in db_roles]
        if role not in valid_role_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rol '{role}' no válido.",
            )

        # 6. Permisos por defecto según rol RBAC
        if role == "CO_LEADER":
            default_perms = {
                "can_upload": True,
                "can_manage_members": True,
                "can_edit_group": True,
            }
        elif role == "UPLOADER":
            default_perms = {
                "can_upload": True,
            }
        else:
            # TRANSLATOR / EDITOR
            default_perms = {
                "can_upload": False,
                "can_submit_draft": True,
            }
        final_perms = payload.permissions or default_perms

        # 7. Registrar miembro
        new_member = ScanGroupMember(
            group_id=group_id,
            user_id=target_user_id,
            role=role,
            permissions=final_perms,
        )
        await self.repository.add_member(new_member)

        # 8. Notificar al usuario
        try:
            group = await self.repository.get_group_by_id(group_id)
            group_name = group.name if group else "un Clan"
            notif_payload = {
                "title": "¡Bienvenido al Clan! 🛡️",
                "message": f"Has sido incorporado al clan '{group_name}' con el rol de {role}.",
                "url": "/pages/scans.html",
            }
            async with resolve_session(self.repository.conn) as session:
                session.add(
                    NotificationORM(
                        user_id=target_user_id,
                        type="scan",
                        payload=notif_payload,
                        is_read=False,
                    )
                )
                await session.commit()
        except Exception:
            pass

        # 9. Retornar datos del nuevo miembro
        members = await self.repository.get_group_members(group_id)
        for m in members:
            if m["user_id"] == target_user_id:
                return m

        return {
            "group_id": group_id,
            "user_id": target_user_id,
            "username": target_user["username"],
            "user_code": target_user["user_code"],
            "avatar_url": target_user.get("avatar_url"),
            "avatar_frame_url": target_user.get("avatar_frame_url"),
            "role": role,
            "role_name": role,
            "permissions": final_perms,
            "joined_at": "now",
        }

    async def join_group(
        self,
        group_id: int,
        current_user: CurrentUser,
        payload: Optional[JoinScanRequest] = None,
    ) -> dict:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El auto-ingreso directo al Scan está deshabilitado por seguridad. Debes ser invitado por el Líder o Colíder del Scan.",
        )

    async def leave_group(self, group_id: int, current_user: CurrentUser) -> dict:
        member = await self.repository.get_member(group_id, current_user.id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No perteneces a este scan.",
            )
        if member.is_leader:
            members = await self.repository.get_group_members(group_id)
            if len(members) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Eres el líder del scan. Debes transferir el liderazgo a otro miembro antes de abandonar.",
                )
        await self.repository.remove_member(group_id, current_user.id)
        await self._invalidate_public_cache()
        return {"message": "Has salido del scan correctamente."}

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
            works, members, treasury = await asyncio.gather(
                self.repository.get_scan_works(scan["id"]),
                self.repository.get_public_scan_members(scan["id"]),
                self.repository.get_scan_treasury(scan["id"]),
            )
        else:
            works = await self.repository.get_scan_works(scan["id"])
            members = await self.repository.get_public_scan_members(scan["id"])
            treasury = await self.repository.get_scan_treasury(scan["id"])
        scan["works"] = works
        scan["members"] = members
        scan["goals"] = treasury.get("funding_goals", [])
        scan["top_supporters"] = treasury.get("top_supporters", [])

        total_views = sum(int(w.get("total_views") or 0) for w in works)
        scored_works = [float(w.get("score") or 0) for w in works if float(w.get("score") or 0) > 0]
        avg_rating = round(sum(scored_works) / len(scored_works), 1) if scored_works else 0.0
        scan["total_views"] = total_views
        scan["avg_rating"] = f"{avg_rating:.1f}"

        total_members = max(1, len(members))
        role_defs = [
            ("LEADER", "Líder", "#fbbf24"),
            ("CO_LEADER", "Colíderes", "#c084fc"),
            ("TRANSLATOR", "Traductores", "#38bdf8"),
            ("EDITOR", "Editores / Typesetters", "#fb7185"),
            ("UPLOADER", "Uploaders", "#34d399"),
        ]
        scan["role_breakdown"] = [
            {
                "key": key,
                "label": label,
                "color": color,
                "count": sum(1 for m in members if str(m.get("role_code") or "").upper() == key),
                "pct": round(sum(1 for m in members if str(m.get("role_code") or "").upper() == key) / total_members * 100),
            }
            for key, label, color in role_defs
        ]
        return scan

    async def get_user_scan(self, user_id: int) -> Optional[dict]:
        return await self.repository.get_user_scan(user_id)
