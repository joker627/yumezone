from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.modules.works.schemas import WorkResponse

LibraryStatus = Literal["READING", "COMPLETED", "ON_HOLD", "PLAN_TO_READ", "DROPPED"]


class LibraryReadingProgress(BaseModel):
    chapter_id: int
    chapter_number: Optional[float] = None
    chapter_text: str
    last_page_read: int = 1
    total_pages: int = 1
    read_chapters: int = 0
    total_chapters: int = 0
    remaining_chapters: int = 0
    page_text: str = ""
    progress_pct: int = 0
    read_at: Optional[datetime] = None
    reader_url: Optional[str] = None


class LibraryItem(WorkResponse):
    library_status: Optional[LibraryStatus] = None
    rating: Optional[float] = None
    notify_new_chapters: bool = True
    added_at: Optional[datetime] = None
    reading_progress: Optional[LibraryReadingProgress] = None


class LibraryWorkStatus(BaseModel):
    in_library: bool
    status: Optional[LibraryStatus] = None
    item: Optional[LibraryItem] = None


class LibraryAdd(BaseModel):
    status: LibraryStatus = "READING"


class LibraryStatusUpdate(BaseModel):
    status: LibraryStatus


class NotificationPreferenceUpdate(BaseModel):
    notify_new_chapters: bool


class NotificationPreferenceResponse(BaseModel):
    work_id: int
    notify_new_chapters: bool


class ReadingHistoryCreate(BaseModel):
    work_id: int = Field(gt=0)
    chapter_id: int = Field(gt=0)
    last_page_read: Optional[int] = Field(default=1, ge=1)
    completed: Optional[bool] = False


class WorkRatingUpdate(BaseModel):
    rating: float = Field(ge=0.5, le=10.0, description="Calificación entre 0.5 y 10.0")


class WorkRatingResponse(BaseModel):
    work_id: int
    user_rating: Optional[float] = None
    rating_average: Optional[float] = None
    rating_count: Optional[int] = None


class MarkAllReadRequest(BaseModel):
    read: bool = True
