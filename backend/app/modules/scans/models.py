from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class ScanGroup(BaseModel):
    id: Optional[int] = None
    name: str
    slug: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    description: Optional[str] = None
    social_links: Optional[Any] = None
    report_methods: Optional[Any] = None
    status: str = "ACTIVE"
    created_at: Optional[datetime] = None


class ScanGroupMember(BaseModel):
    group_id: int
    user_id: int
    role: str = "UPLOADER"
    permissions: Optional[Any] = None
    joined_at: Optional[datetime] = None

    @property
    def is_leader(self) -> bool:
        """Determina si el miembro es el líder/propietario del scan."""
        return self.role == "LEADER"

    @property
    def can_manage(self) -> bool:
        """Determina si el miembro tiene permisos administrativos según el JSON de permisos o liderazgo."""
        if self.is_leader:
            return True
        perms = self.permissions if isinstance(self.permissions, dict) else {}
        return bool(perms.get("can_manage_members") or perms.get("can_edit_group") or self.role == "CO_LEADER")

    @property
    def can_upload(self) -> bool:
        """Determina si el miembro tiene permiso para subir capítulos según su JSON de permisos."""
        if self.is_leader:
            return True
        perms = self.permissions if isinstance(self.permissions, dict) else {}
        # Por defecto los roles UPLOADER o CO_LEADER tienen permiso a menos que se revoque en JSON
        if "can_upload" in perms:
            return bool(perms["can_upload"])
        return self.role in ("CO_LEADER", "UPLOADER")


