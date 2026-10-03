from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserLibrary(BaseModel):
    user_id: int
    work_id: int
    status: str = "FOLLOWING"
    rating: Optional[float] = None
    notify_new_chapters: bool = True
    added_at: Optional[datetime] = None


class ReadingHistory(BaseModel):
    id: Optional[int] = None
    user_id: int
    work_id: int
    chapter_id: int
    last_page_read: int = 1
    read_at: Optional[datetime] = None
