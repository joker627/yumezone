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
    vault_tokens: int = 0
    total_contributed_tokens: int = 0
    clan_level: int = 1
    created_at: Optional[datetime] = None
    works_count: Optional[int] = 0
    chapters_count: Optional[int] = 0
    members_count: Optional[int] = 0


class ScanGroupMember(BaseModel):
    group_id: int
    user_id: int
    role: str = "UPLOADER"
    permissions: Optional[Any] = None
    joined_at: Optional[datetime] = None

    @property
    def is_leader(self) -> bool:
        return self.role == "LEADER"

    @property
    def can_manage(self) -> bool:
        if self.is_leader:
            return True
        perms = self.permissions if isinstance(self.permissions, dict) else {}
        return bool(perms.get("can_manage_members") or perms.get("can_edit_group") or self.role == "CO_LEADER")

    @property
    def can_upload(self) -> bool:
        if self.is_leader:
            return True
        perms = self.permissions if isinstance(self.permissions, dict) else {}
        if "can_upload" in perms:
            return bool(perms["can_upload"])
        return self.role in ("CO_LEADER", "UPLOADER")

    @property
    def can_submit_draft(self) -> bool:
        return True


class ScanGroupCreate(BaseModel):
    name: str
    description: str | None = None
    logo_url: str | None = None
    banner_url: str | None = None


class ScanGroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    logo_url: str | None = None
    banner_url: str | None = None
    social_links: dict[str, object] | None = None
    report_methods: dict[str, object] | None = None
    status: str | None = None


class ScanGroupResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    logo_url: str | None = None
    banner_url: str | None = None
    social_links: dict[str, object] | None = None
    report_methods: dict[str, object] | None = None
    status: str
    vault_tokens: int = 0
    total_contributed_tokens: int = 0
    clan_level: int = 1
    works_count: int | None = 0
    chapters_count: int | None = 0
    members_count: int | None = 0


class ConvertAndDonateRequest(BaseModel):
    coins_to_convert: int = 0
    direct_tokens: int = 0
    goal_id: int | None = None


class CreateFundingGoalRequest(BaseModel):
    title: str
    description: str | None = None
    work_id: int | None = None
    target_tokens: int = 25


class RewardMemberRequest(BaseModel):
    target_user_id: int
    amount_tokens: int
    reason: str | None = None


class CreateScanAnnouncementRequest(BaseModel):
    title: str
    description: str
    type_label: str = "Scans"
    use_vault: bool = False


class ScanGroupMemberResponse(BaseModel):
    group_id: int
    user_id: int
    username: str
    user_code: str
    role: str
    role_name: str | None = None
    avatar_url: str | None = None
    avatar_frame_url: str | None = None
    permissions: dict[str, object] | None = None
    joined_at: datetime


class AddMemberRequest(BaseModel):
    user_identifier: str
    role: str = "UPLOADER"
    permissions: dict[str, object] | None = None


class JoinScanRequest(BaseModel):
    role: str | None = "UPLOADER"


class UpdateMemberPermissions(BaseModel):
    role: str | None = None
    permissions: dict[str, object] | None = None
