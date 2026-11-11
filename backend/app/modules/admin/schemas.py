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


class MissionCreate(BaseModel):
    mission_key: str = Field(min_length=2, max_length=50)
    title: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=2, max_length=255)
    category: str = "LECTURA"
    mission_type: Literal["DAILY", "WEEKLY", "EVENT"] = "DAILY"
    event_name: Optional[str] = None
    icon: str = "book-open"
    target_count: int = 1
    condition_type: Literal[
        "CHAPTERS_READ",
        "COMMENTS",
        "LIBRARY_COUNT",
        "DAILY_CHEST",
        "CONVERT_TOKENS",
        "DONATE_SCAN",
    ] = "CHAPTERS_READ"
    reward_xp: int = 15
    reward_coins: int = 3
    reward_clan_tokens: int = 0
    action_url: str = "/pages/catalogo.html"
    action_text: str = "Explorar obras"
    sort_order: int = 0
    is_active: bool = True
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None


class MissionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    mission_type: Optional[Literal["DAILY", "WEEKLY", "EVENT"]] = None
    event_name: Optional[str] = None
    icon: Optional[str] = None
    target_count: Optional[int] = None
    condition_type: Optional[
        Literal[
            "CHAPTERS_READ",
            "COMMENTS",
            "LIBRARY_COUNT",
            "DAILY_CHEST",
            "CONVERT_TOKENS",
            "DONATE_SCAN",
        ]
    ] = None
    reward_xp: Optional[int] = None
    reward_coins: Optional[int] = None
    reward_clan_tokens: Optional[int] = None
    action_url: Optional[str] = None
    action_text: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None


class ViewLogCreate(BaseModel):
    work_id: int
    chapter_id: Optional[int] = None

