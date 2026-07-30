from typing import Generic, TypeVar, List
from pydantic import BaseModel
import math

T = TypeVar('T')

class PaginationItemsInfo(BaseModel):
    count: int
    total: int
    per_page: int

class PaginationInfo(BaseModel):
    last_visible_page: int
    has_next_page: bool
    current_page: int
    items: PaginationItemsInfo

class PaginatedResponse(BaseModel, Generic[T]):
    pagination: PaginationInfo
    data: List[T]

def create_paginated_response(data: List[T], total: int, limit: int, offset: int) -> PaginatedResponse[T]:
    # avoid division by zero
    per_page = limit if limit > 0 else 1
    current_page = (offset // per_page) + 1
    last_visible_page = math.ceil(total / per_page) if total > 0 else 1
    has_next_page = current_page < last_visible_page

    return PaginatedResponse(
        pagination=PaginationInfo(
            last_visible_page=last_visible_page,
            has_next_page=has_next_page,
            current_page=current_page,
            items=PaginationItemsInfo(
                count=len(data),
                total=total,
                per_page=per_page
            )
        ),
        data=data
    )
