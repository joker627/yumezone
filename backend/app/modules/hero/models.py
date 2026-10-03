from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HeroQueueItem(BaseModel):
    id: Optional[int] = None
    work_id: int
    status: str = "PENDING"
    queued_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
