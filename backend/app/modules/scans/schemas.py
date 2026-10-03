from datetime import datetime

from pydantic import BaseModel


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
    status: str


class ScanGroupMemberResponse(BaseModel):
    group_id: int
    user_id: int
    username: str
    user_code: str
    role: str
    permissions: dict[str, object] | None = None
    joined_at: datetime


class UpdateMemberPermissions(BaseModel):
    role: str | None = None
    permissions: dict[str, object] | None = None
