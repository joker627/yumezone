from typing import Literal, Optional
from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    work_id: int = Field(gt=0)
    chapter_id: Optional[int] = Field(default=None, gt=0)
    parent_id: Optional[int] = Field(default=None, gt=0)
    content: str = Field(min_length=1, max_length=3000)
    contains_spoiler: bool = False


class CommentUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=3000)
    contains_spoiler: bool = False


class ReactionCreate(BaseModel):
    reaction: Literal["LIKE", "DISLIKE"]


class CommentReportCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=100)
    details: Optional[str] = Field(default=None, max_length=2000)
