from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# ESQUEMAS PARA IMÁGENES
class ChapterImageResponse(BaseModel):
    id: int
    chapter_id: int
    image_url: str
    order_number: int

# ESQUEMAS PARA CAPÍTULOS
class ChapterCreate(BaseModel):
    work_id: int
    chapter_number: float
    title: Optional[str] = None
    scan_group_id: Optional[int] = None

class ChapterUpdate(BaseModel):
    chapter_number: Optional[float] = None
    title: Optional[str] = None
    scan_group_id: Optional[int] = None
    status: Optional[str] = None

class ChapterResponse(BaseModel):
    id: int
    work_id: int
    scan_group_id: Optional[int] = None
    chapter_number: float
    title: Optional[str] = None
    slug: str
    status: str
    published_at: Optional[datetime] = None
    
    # Lista de imágenes vinculadas al capítulo
    images: Optional[List[ChapterImageResponse]] = []
