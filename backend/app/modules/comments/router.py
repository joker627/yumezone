from typing import Annotated, Literal, Optional

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.users.models import CurrentUser

router = APIRouter()


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


@router.get("/")
async def list_comments(
    work_id: Annotated[int, Query(gt=0)],
    chapter_id: Annotated[Optional[int], Query(gt=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    chapter_filter = "AND c.chapter_id = %s" if chapter_id else "AND c.chapter_id IS NULL"
    values = (work_id, chapter_id, limit) if chapter_id else (work_id, limit)
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            f"""
            SELECT c.id, c.work_id, c.chapter_id, c.parent_id, c.content, c.contains_spoiler,
                   c.created_at, c.updated_at, u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(cr.reaction = 'LIKE'), 0) AS likes,
                   COALESCE(SUM(cr.reaction = 'DISLIKE'), 0) AS dislikes
            FROM comments c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN comment_reactions cr ON cr.comment_id = c.id
            WHERE c.work_id = %s AND c.status = 'VISIBLE' {chapter_filter}
            GROUP BY c.id, u.id
            ORDER BY c.created_at DESC LIMIT %s
            """,
            values,
        )
        return {"data": await cur.fetchall()}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_comment(
    payload: CommentCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor(aiomysql.DictCursor) as cur:
        if payload.chapter_id:
            await cur.execute(
                "SELECT 1 FROM chapters WHERE id = %s AND work_id = %s AND status = 'PUBLISHED'",
                (payload.chapter_id, payload.work_id),
            )
            if await cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Capítulo no encontrado en la obra")
        if payload.parent_id:
            await cur.execute(
                "SELECT 1 FROM comments WHERE id = %s AND work_id = %s AND chapter_id <=> %s",
                (payload.parent_id, payload.work_id, payload.chapter_id),
            )
            if await cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Comentario padre no encontrado")
        await cur.execute(
            """
            INSERT INTO comments (work_id, chapter_id, user_id, parent_id, content, contains_spoiler)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (payload.work_id, payload.chapter_id, current_user.id, payload.parent_id,
             payload.content.strip(), payload.contains_spoiler),
        )
        comment_id = cur.lastrowid
    await conn.commit()
    return {"id": comment_id}


async def get_owned_comment(
    conn: aiomysql.Connection, comment_id: int, current_user: CurrentUser
) -> dict:
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute("SELECT id, user_id, status FROM comments WHERE id = %s", (comment_id,))
        comment = await cur.fetchone()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    is_admin = current_user.platform_role.upper() in {"ADMIN", "SUPERADMIN"}
    if comment["user_id"] != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="No puedes modificar este comentario")
    return comment


@router.patch("/{comment_id}")
async def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    await get_owned_comment(conn, comment_id, current_user)
    async with conn.cursor() as cur:
        await cur.execute(
            "UPDATE comments SET content = %s, contains_spoiler = %s WHERE id = %s",
            (payload.content.strip(), payload.contains_spoiler, comment_id),
        )
    await conn.commit()
    return None


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    await get_owned_comment(conn, comment_id, current_user)
    async with conn.cursor() as cur:
        await cur.execute("UPDATE comments SET status = 'DELETED', content = '' WHERE id = %s", (comment_id,))
    await conn.commit()
    return None


@router.put("/{comment_id}/reaction")
async def react_to_comment(
    comment_id: int,
    payload: ReactionCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor() as cur:
        await cur.execute("SELECT 1 FROM comments WHERE id = %s AND status = 'VISIBLE'", (comment_id,))
        if await cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Comentario no encontrado")
        await cur.execute(
            """
            INSERT INTO comment_reactions (comment_id, user_id, reaction)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)
            """,
            (comment_id, current_user.id, payload.reaction),
        )
    await conn.commit()
    return {"comment_id": comment_id, "reaction": payload.reaction}


@router.post("/{comment_id}/reports", status_code=status.HTTP_201_CREATED)
async def report_comment(
    comment_id: int,
    payload: CommentReportCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor() as cur:
        await cur.execute("SELECT 1 FROM comments WHERE id = %s", (comment_id,))
        if await cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Comentario no encontrado")
        await cur.execute(
            """
            INSERT INTO content_reports (reporter_user_id, entity_type, entity_id, reason, details)
            VALUES (%s, 'COMMENT', %s, %s, %s)
            """,
            (current_user.id, comment_id, payload.reason.strip(), payload.details),
        )
        report_id = cur.lastrowid
    await conn.commit()
    return {"id": report_id}
