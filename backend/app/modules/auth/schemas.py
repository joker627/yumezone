import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional

# imports external
from datetime import datetime, date


# validate data user for response
class UserBase(BaseModel):
    id: Optional[int] = None
    user_code: Optional[str] = None
    username: str
    email: str
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    bio: Optional[str] = None
    is_private: bool
    platform_role: str
    is_scan_member: bool = False
    status: str
    xp: int = 0
    coins: int = 0
    streak_days: int = 0
    last_streak_date: Optional[date] = None
    streak_event: Optional[str] = None
    streak_message: Optional[str] = None
    previous_streak: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# validate user login
class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


# validate user register
class UserCreate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


# validate token
class Token(BaseModel):
    access_token: str
    token_type: str


# validate user update
class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=500)
    is_private: Optional[bool] = None

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, v: Optional[str]) -> Optional[str]:
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

