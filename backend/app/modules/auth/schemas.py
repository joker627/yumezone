# imports internal
from pydantic import BaseModel
from typing import Optional
# imports external
from datetime import datetime

#validate data user for response
class UserBase(BaseModel):
    id: Optional[int] = None
    user_code: Optional[str] = None
    username: str
    email: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_private: bool
    platform_role: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# validate user login 
class UserLogin(BaseModel):
    email: str
    password: str

# validate user register 
class UserCreate(BaseModel):
    username: Optional[str] = None
    email: str
    password: str

# validate token
class Token(BaseModel):
    access_token: str
    token_type: str

# validate user update
class UserUpdate(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_private: Optional[bool] = None
