from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, field_serializer


class Work(BaseModel):
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
    format_name: Optional[str] = None
    status_name: Optional[str] = None
    demographic_name: Optional[str] = None
    scan_group_id: Optional[int] = None
    total_views: int = 0
    rating_average: float = 0.0
    rating_count: int = 0
    favorites_count: int = 0
    trending_score: float = 0.0
    views_last_24h: int = 0
    chapters_count: int = 0
    first_chapter_id: Optional[int] = None
    genres: list[dict[str, object]] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WorkFilterOption(BaseModel):
    id: int
    name: str


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
    format_name: Optional[str] = None
    status_name: Optional[str] = None
    demographic_name: Optional[str] = None
    scan_group_id: Optional[int] = None
    total_views: int = 0
    rating_average: float = 0.0
    rating_count: int = 0
    favorites_count: int = 0
    trending_score: float = 0.0
    views_last_24h: int = 0
    chapters_count: int = 0
    first_chapter_id: Optional[int] = None
    genres: list[WorkFilterOption] = Field(default_factory=list)
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
    genre_ids: Optional[list[int]] = None


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
    genre_ids: Optional[list[int]] = None


# Esquema para paginacion
class PaginationItems(BaseModel):
    count: int
    total: int
    per_page: int


class PaginationInfo(BaseModel):
    last_visible_page: int
    has_previous_page: bool
    has_next_page: bool
    previous_page: Optional[int]
    next_page: Optional[int]
    current_page: int
    items: PaginationItems


class WorkPaginatedResponse(BaseModel):
    pagination: PaginationInfo
    data: list[WorkResponse]


class WorkFiltersResponse(BaseModel):
    formats: list[WorkFilterOption]
    statuses: list[WorkFilterOption]
    demographics: list[WorkFilterOption]
    genres: list[WorkFilterOption]


class WorkDetailChapterItem(BaseModel):
    id: int
    chapter_number: Decimal
    title: Optional[str] = None
    slug: str
    published_at: Optional[datetime] = None

    @field_serializer("chapter_number")
    def serialize_chapter_number(self, val: Decimal) -> str:
        return f"{float(val):.1f}"


class WorkDetailReadingProgress(BaseModel):
    chapter_id: int
    chapter_number: Optional[Decimal] = None
    last_page_read: int = 1
    read_at: Optional[datetime] = None

    @field_serializer("chapter_number")
    def serialize_chapter_number(self, val: Optional[Decimal]) -> Optional[str]:
        if val is None:
            return None
        return f"{float(val):.1f}"


class WorkDetailUserState(BaseModel):
    in_library: bool = False
    library_status: Optional[str] = None
    read_chapter_ids: list[int] = []
    reading_progress: Optional[WorkDetailReadingProgress] = None


class WorkLibraryStats(BaseModel):
    reading: int = 0
    plan_to_read: int = 0
    completed: int = 0
    on_hold: int = 0
    dropped: int = 0
    total: int = 0


class WorkDetailResponse(BaseModel):
    work: WorkResponse
    chapters: list[WorkDetailChapterItem] = []
    user_state: WorkDetailUserState
    library_stats: Optional[WorkLibraryStats] = None

