from pydantic import BaseModel
from typing import Optional

class ViewLogCreate(BaseModel):
    work_id: int
    chapter_id: Optional[int] = None
