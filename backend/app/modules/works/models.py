from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# Modelo de base de datos works
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
    scan_group_id: Optional[int] = None
    total_views: int = 0
    rating_average: float = 0.0
    rating_count: int = 0
    followers_count: int = 0
    favorites_count: int = 0
    trending_score: float = 0.0
    views_last_24h: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
