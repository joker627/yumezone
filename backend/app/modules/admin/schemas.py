from typing import Literal, Optional
from pydantic import BaseModel, Field


class UserStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "SUSPENDED", "BLOCKED", "DELETED"]


class SettingUpdate(BaseModel):
    value: object
    description: Optional[str] = Field(default=None, max_length=255)


class ReportReview(BaseModel):
    status: Literal["REVIEWING", "RESOLVED", "DISMISSED"]


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
