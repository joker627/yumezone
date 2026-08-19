from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Modelo de base de datos User
class User(BaseModel):
    id: Optional[int] = None
    user_code: Optional[str] = None
    username: str
    email: str
    password: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_private: bool = False
    platform_role: str = "user"
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
