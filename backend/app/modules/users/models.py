from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: Optional[int] = None
    user_code: str
    username: str
    email: str
    password: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_private: bool = False
    platform_role: str = "USER"
    status: str = "ACTIVE"
    xp: int = 0
    coins: int = 0
    streak_days: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CurrentUser(BaseModel):
    """Usuario autenticado. Garantiza que `id` existe (viene de la BD)."""

    id: int
    user_code: str
    username: str
    email: str
    password: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_private: bool = False
    platform_role: str = "USER"
    status: str = "ACTIVE"
    xp: int = 0
    coins: int = 0
    streak_days: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ReadingSettings(BaseModel):
    user_id: int
    reading_mode: str = "VERTICAL"
    zoom_level: int = 100
    brightness: int = 100
    background_color: str = "DARK"
    image_quality: str = "HIGH"
