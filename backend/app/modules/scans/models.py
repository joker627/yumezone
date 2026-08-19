from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class ScanGroup(BaseModel):
    id: Optional[int] = None
    name: str
    slug: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    description: Optional[str] = None
    social_links: Optional[Any] = None
    report_methods: Optional[Any] = None
    status: str = 'ACTIVE'
    created_at: Optional[datetime] = None

class ScanGroupMember(BaseModel):
    group_id: int
    user_id: int
    role: str = 'MEMBER'
    permissions: Optional[Any] = None
    joined_at: Optional[datetime] = None

class ScanGroupInvitation(BaseModel):
    id: Optional[int] = None
    group_id: int
    user_id: int
    status: str = 'PENDING'
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
