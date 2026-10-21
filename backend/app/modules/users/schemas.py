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
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = "CO"
    bio: Optional[str] = None
    is_private: bool
    platform_role: str
    coins: int
    xp: int
    streak_days: int
    last_streak_date: Optional[date] = None
    created_at: datetime
    is_owner: bool = False
    is_hidden: bool = False
    scan_group: Optional[dict] = None
    stats: Optional[UserProfileStats] = None
    level_info: Optional[LevelInfo] = None
    favorite_works: List[Dict[str, Any]] = []
    recent_activity: List[Dict[str, Any]] = []
    genres_breakdown: List[Dict[str, Any]] = []
    badges: List[Dict[str, Any]] = []


import re
from pydantic import BaseModel, field_validator

class UserUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = None
    is_private: Optional[bool] = None

    @field_validator("avatar_url", "banner_url", "anillo_url", "avatar_frame_url")
    @classmethod
    def validate_url_fields(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if not v:
            return None
        if any(c in v for c in ['"', "'", '<', '>', '\n', '\r', ' ']):
            raise ValueError("La URL contiene caracteres no permitidos")
        if not re.match(r"^(https?://|/)", v, re.IGNORECASE):
            raise ValueError("La URL debe iniciar con http://, https:// o /")
        return v

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().upper()
        if not re.match(r"^[A-Z]{2}$", v):
            raise ValueError("El código de país debe ser un código ISO de 2 letras (ej. CO, MX, AR)")
        return v


class UserSearchItem(BaseModel):
    id: int
    user_code: str
    username: str
    avatar_url: Optional[str] = None
    xp: int
    platform_role: str
