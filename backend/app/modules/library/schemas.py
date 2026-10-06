from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.modules.works.schemas import WorkResponse

LibraryStatus = Literal["FAVORITE", "FOLLOWING", "READ_LATER", "COMPLETED", "DROPPED"]


class LibraryItem(WorkResponse):
    library_status: LibraryStatus
    rating: Optional[float] = None
    notify_new_chapters: bool = True
    added_at: Optional[datetime] = None


class LibraryAdd(BaseModel):
    status: LibraryStatus = "FOLLOWING"


class LibraryStatusUpdate(BaseModel):
    status: LibraryStatus


class NotificationPreferenceUpdate(BaseModel):
    notify_new_chapters: bool


class NotificationPreferenceResponse(BaseModel):
    work_id: int
    notify_new_chapters: bool
