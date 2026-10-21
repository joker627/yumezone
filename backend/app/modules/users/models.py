from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: Optional[int] = None
    user_code: str
    username: str
    email: str
    password: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = "CO"
    bio: Optional[str] = None
    is_private: bool = False
    platform_role: str = "USER"
    status: str = "ACTIVE"
    xp: int = 0
    coins: int = 0
    streak_days: int = 0
    last_streak_date: Optional[date] = None
    streak_event: Optional[str] = None
    streak_message: Optional[str] = None
    previous_streak: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CurrentUser(BaseModel):
    """Usuario autenticado. Nunca incluye el hash de contraseña."""

    id: int
    user_code: str
    username: str
    email: str
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = "CO"
    bio: Optional[str] = None
    is_private: bool = False
    platform_role: str = "USER"
    is_scan_member: bool = False
    status: str = "ACTIVE"
    xp: int = 0
    coins: int = 0
    streak_days: int = 0
    last_streak_date: Optional[date] = None
    streak_event: Optional[str] = None
    streak_message: Optional[str] = None
    previous_streak: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


