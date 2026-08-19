from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Modelo de base de datos para la tabla 'chapters'
class Chapter(BaseModel):
    id: Optional[int] = None
    work_id: int
    scan_group_id: Optional[int] = None
    chapter_number: float
    title: Optional[str] = None
    slug: str
    status: str = "PUBLISHED"
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# Modelo de base de datos para la tabla 'chapter_images'
class ChapterImage(BaseModel):
    id: Optional[int] = None
    chapter_id: int
    image_url: str
    order_number: int
