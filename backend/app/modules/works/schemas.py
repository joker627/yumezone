# imports internal
from pydantic import BaseModel
from typing import Optional
# imports external
from datetime import datetime

# validate data work for response
class WorkResponse(BaseModel):
    id: Optional[int] = None
    title: str
    slug: str
    alternative_title: Optional[str] = None
    synopsis: Optional[str] = None
    author: Optional[str] = None
    cover_url: Optional[str] = None
    banner_url: Optional[str] = None
    status_id: Optional[int] = None
    format_id: Optional[int] = None
    demographic_id: Optional[int] = None
    scan_group_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# validate data work for create
class WorkCreate(BaseModel):
    title: str
    alternative_title: Optional[str] = None
    synopsis: Optional[str] = None
    author: Optional[str] = None
    cover_url: Optional[str] = None
    banner_url: Optional[str] = None
    status_id: Optional[int] = None
    format_id: Optional[int] = None
    demographic_id: Optional[int] = None
    scan_group_id: Optional[int] = None

# validate data work for update
class WorkUpdate(BaseModel):
    title: Optional[str] = None
    alternative_title: Optional[str] = None
    synopsis: Optional[str] = None
    author: Optional[str] = None
    cover_url: Optional[str] = None
    banner_url: Optional[str] = None
    status_id: Optional[int] = None
    format_id: Optional[int] = None
    demographic_id: Optional[int] = None
    scan_group_id: Optional[int] = None

# Esquema para paginacion
class PaginationItems(BaseModel):
    count: int
    total: int
    per_page: int

class PaginationInfo(BaseModel):
    last_visible_page: int
    has_next_page: bool
    current_page: int
    items: PaginationItems

class WorkPaginatedResponse(BaseModel):
    pagination: PaginationInfo
    data: list[WorkResponse]
