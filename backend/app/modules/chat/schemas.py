from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500, description="Contenido del mensaje de chat")


class ReactionItem(BaseModel):
    reaction: str
    count: int
    user_reacted: bool = False


class ChatReactionToggle(BaseModel):
    reaction: str = Field(..., min_length=1, max_length=16, description="Emoji de la reacción (ej: ❤️, 👍, 😂, 🔥)")


class ChatMessageResponse(BaseModel):
    id: int
    user_id: int
    username: str
    avatar_url: Optional[str] = None
    anillo_url: Optional[str] = None
    platform_role: str = "USER"
    xp: int = 0
    content: str
    created_at: datetime
    reactions: List[ReactionItem] = []


class OnlineUserItem(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None
    anillo_url: Optional[str] = None
    platform_role: str = "USER"
    xp: int = 0


class OnlineStatsResponse(BaseModel):
    online_count: int
    active_users: List[OnlineUserItem]
