from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field, field_serializer, field_validator


class ChapterImageResponse(BaseModel):
    id: int
    chapter_id: int
    image_url: str
    order_number: int


class ChapterPageReference(BaseModel):
    image_url: Annotated[str, Field(min_length=1, max_length=1024)]
    order_number: Annotated[int, Field(ge=1)]

    @field_validator("image_url")
    @classmethod
    def validate_image_reference(cls, value: str) -> str:
        value = value.strip()
        if not (value.startswith("https://") or (value.startswith("/") and not value.startswith("//"))):
            raise ValueError("image_url debe ser una URL HTTPS o una ruta absoluta")
        return value


class ChapterPagesReplace(BaseModel):
    pages: list[ChapterPageReference] = Field(min_length=1, max_length=500)


class ChapterCreate(BaseModel):
    work_id: int
    chapter_number: Annotated[Decimal, Field(max_digits=6, decimal_places=2, ge=0)]
    title: Optional[str] = Field(default=None, max_length=255)
    scan_group_id: Optional[int] = None
    reward_coins: Optional[int] = Field(default=50, ge=0, le=1000)


class ChapterUpdate(BaseModel):
    chapter_number: Optional[Annotated[Decimal, Field(max_digits=6, decimal_places=2, ge=0)]] = None
    title: Optional[str] = Field(default=None, max_length=255)
    scan_group_id: Optional[int] = None
    status: Optional[Literal["DRAFT", "PUBLISHED", "SCHEDULED", "HIDDEN"]] = None
    reward_coins: Optional[int] = Field(default=None, ge=0, le=1000)


class ChapterResponse(BaseModel):
    id: int
    work_id: int
    scan_group_id: Optional[int] = None
    chapter_number: Decimal
    title: Optional[str] = None
    slug: str
    status: str
    translator_user_id: Optional[int] = None
    translator_username: Optional[str] = None
    reward_coins: Optional[int] = 50
    published_at: Optional[datetime] = None
    images: Optional[list[ChapterImageResponse]] = []

    @field_serializer("chapter_number")
    def serialize_chapter_number(self, val: Decimal) -> str:
        return f"{float(val):.1f}"


class ChapterSubmissionCreate(BaseModel):
    content_url: str = Field(min_length=5, max_length=2048)
    page_count: int = Field(ge=1)
    notes: Optional[str] = Field(default=None, max_length=500)


class ChapterSubmissionReview(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    reward_coins: Optional[int] = Field(default=None, ge=0, le=1000)
    rejection_reason: Optional[str] = Field(default=None, max_length=255)


class ChapterSubmissionResponse(BaseModel):
    id: int
    chapter_id: int
    user_id: int
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    content_url: str
    page_count: int
    status: str
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ReaderChapterInfo(BaseModel):
    id: int
    work_id: int
    scan_group_id: Optional[int] = None
    scan_group_name: Optional[str] = None
    chapter_number: Decimal
    title: Optional[str] = None
    slug: str
    status: str
    translator_user_id: Optional[int] = None
    translator_username: Optional[str] = None
    reward_coins: Optional[int] = 50
    published_at: Optional[datetime] = None

    @field_serializer("chapter_number")
    def serialize_chapter_number(self, val: Decimal) -> str:
        return f"{float(val):.1f}"


class ReaderWorkInfo(BaseModel):
    id: int
    title: str
    slug: str
    cover_url: Optional[str] = None
    banner_url: Optional[str] = None
    author: Optional[str] = None


class ReaderNavigationItem(BaseModel):
    id: int
    chapter_number: Decimal
    title: Optional[str] = None
    slug: Optional[str] = None

    @field_serializer("chapter_number")
    def serialize_chapter_number(self, val: Decimal) -> str:
        return f"{float(val):.1f}"


class ReaderNavigationInfo(BaseModel):
    prev_chapter_id: Optional[int] = None
    next_chapter_id: Optional[int] = None
    chapters: list[ReaderNavigationItem] = []


class ReaderUserState(BaseModel):
    is_read: bool = False
    in_library: bool = False
    last_page_read: int = 1
    has_higher_chapter_read: bool = False


class ChapterReaderResponse(BaseModel):
    chapter: ReaderChapterInfo
    work: ReaderWorkInfo
    pages: list[ChapterImageResponse] = []
    navigation: ReaderNavigationInfo
    user_state: ReaderUserState

