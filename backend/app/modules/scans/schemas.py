from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ScanGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None

class ScanGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None
    report_methods: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

class ScanGroupResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    status: str

class ScanGroupMemberResponse(BaseModel):
    group_id: int
    user_id: int
    username: str
    user_code: str
    role: str
    permissions: Optional[Dict[str, Any]] = None
    joined_at: datetime

class InviteUserRequest(BaseModel):
    user_code: str
    
class ScanGroupInvitationResponse(BaseModel):
    id: int
    group_id: int
    group_name: str
    user_id: int
    status: str
    expires_at: Optional[datetime] = None

class UpdateMemberPermissions(BaseModel):
    role: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None
