from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date

class UserProfileStats(BaseModel):
    total_chapters_read: int = 0
    completed_works: int = 0
    favorites_count: int = 0
    following_count: int = 0
    total_comments: int = 0

class LevelInfo(BaseModel):
    level: int = 1
    current_level_xp: int = 0
    remaining_xp: int = 1000
    percentage: int = 0
    current_title: str = "Iniciado del Cultivo"
    next_title: str = "Lector Novato"

class UserProfileResponse(BaseModel):
    id: int
    user_code: str
    username: str
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    bio: Optional[str] = None
    is_private: bool
    platform_role: str
    coins: int
    xp: int
    streak_days: int
    last_streak_date: Optional[date] = None
    created_at: datetime
    is_hidden: bool = False
    scan_group: Optional[dict] = None
    stats: Optional[UserProfileStats] = None
    level_info: Optional[LevelInfo] = None
    favorite_works: List[Dict[str, Any]] = []
    recent_activity: List[Dict[str, Any]] = []
    genres_breakdown: List[Dict[str, Any]] = []
    badges: List[Dict[str, Any]] = []


class UserUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_private: Optional[bool] = None

class UserSearchItem(BaseModel):
    id: int
    user_code: str
    username: str
    avatar_url: Optional[str] = None
    xp: int
    platform_role: str
