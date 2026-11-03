from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class Chapter(BaseModel):
    id: Optional[int] = None
    work_id: int
    scan_group_id: Optional[int] = None
    chapter_number: Decimal
    title: Optional[str] = None
    slug: str
    status: str = "PUBLISHED"
    translator_user_id: Optional[int] = None
    reward_coins: int = 50
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ChapterImage(BaseModel):
    id: Optional[int] = None
    chapter_id: int
    image_url: str
    order_number: int


class ChapterSubmission(BaseModel):
    id: Optional[int] = None
    chapter_id: int
    user_id: int
    content_url: str
    page_count: int
    status: str = "PENDING"
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
