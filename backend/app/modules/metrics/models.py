from typing import Optional

from pydantic import BaseModel


class WorkStatistics(BaseModel):
    work_id: int
    total_views: int = 0
    daily_views: int = 0
    weekly_views: int = 0
    monthly_views: int = 0
    rating_average: float = 0.0
    rating_count: int = 0
    trending_score: float = 0.0
    views_last_24h: int = 0
    followers_count: int = 0
    favorites_count: int = 0


class ViewLog(BaseModel):
    id: Optional[int] = None
    work_id: int
    chapter_id: Optional[int] = None
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
