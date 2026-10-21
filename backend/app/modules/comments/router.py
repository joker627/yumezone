from typing import Annotated, Optional
import aiomysql
from fastapi import APIRouter, Depends, Query, status

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.comments.repository import CommentRepository
from app.modules.comments.schemas import (
    CommentCreate,
    CommentReportCreate,
    CommentUpdate,
    ReactionCreate,
)
from app.modules.comments.services import CommentService
from app.modules.users.models import CurrentUser

router = APIRouter()


def get_comment_service(conn: aiomysql.Connection = Depends(get_db_connection)) -> CommentService:
    repository = CommentRepository(conn)
    return CommentService(repository)


@router.get("/")
async def list_comments(
    work_id: Annotated[int, Query(gt=0)],
    chapter_id: Annotated[Optional[int], Query(gt=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    service: CommentService = Depends(get_comment_service),
):
    comments = await service.list_comments(work_id, chapter_id, limit)
    return {"data": comments}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_comment(
    payload: CommentCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: CommentService = Depends(get_comment_service),
):
    comment_id = await service.create_comment(
        work_id=payload.work_id,
        chapter_id=payload.chapter_id,
        current_user=current_user,
        parent_id=payload.parent_id,
        content=payload.content,
        contains_spoiler=payload.contains_spoiler,
    )
    return {"id": comment_id}


@router.patch("/{comment_id}")
async def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: CommentService = Depends(get_comment_service),
):
    await service.update_comment(
        comment_id=comment_id,
        content=payload.content,
        contains_spoiler=payload.contains_spoiler,
        current_user=current_user,
    )
    return None


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: CommentService = Depends(get_comment_service),
):
    await service.delete_comment(comment_id, current_user)
    return None


@router.put("/{comment_id}/reaction")
async def react_to_comment(
    comment_id: int,
    payload: ReactionCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: CommentService = Depends(get_comment_service),
):
    await service.react_to_comment(comment_id, payload.reaction, current_user)
    return {"comment_id": comment_id, "reaction": payload.reaction}


@router.post("/{comment_id}/reports", status_code=status.HTTP_201_CREATED)
async def report_comment(
    comment_id: int,
    payload: CommentReportCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: CommentService = Depends(get_comment_service),
):
    report_id = await service.report_comment(
        comment_id=comment_id,
        reason=payload.reason,
        details=payload.details,
        current_user=current_user,
    )
    return {"id": report_id}
