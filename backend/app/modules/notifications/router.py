import json
from typing import Annotated

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.users.models import CurrentUser

router = APIRouter()


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    where = "AND read_at IS NULL" if unread_only else ""
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            f"""
            SELECT id, type, payload, read_at, created_at
            FROM notifications
            WHERE user_id = %s {where}
            ORDER BY created_at DESC LIMIT %s
            """,
            (current_user.id, limit),
        )
        rows = await cur.fetchall()
        for r in rows:
            if isinstance(r.get("payload"), str):
                try:
                    r["payload"] = json.loads(r["payload"])
                except Exception:
                    pass

        await cur.execute(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND read_at IS NULL",
            (current_user.id,)
        )
        count_row = await cur.fetchone()
        unread_count = count_row["count"] if count_row else 0
        return {"data": rows, "unread_count": unread_count}


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor() as cur:
        await cur.execute(
            "UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = %s AND user_id = %s",
            (notification_id, current_user.id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")
    await conn.commit()
    return None


@router.patch("/read-all")
async def mark_all_read(
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor() as cur:
        await cur.execute(
            "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = %s AND read_at IS NULL",
            (current_user.id,),
        )
    await conn.commit()
    return None


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor() as cur:
        await cur.execute(
            "DELETE FROM notifications WHERE id = %s AND user_id = %s",
            (notification_id, current_user.id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")
    await conn.commit()
    return None


@router.delete("/")
async def clear_notifications(
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    async with conn.cursor() as cur:
        await cur.execute(
            "DELETE FROM notifications WHERE user_id = %s",
            (current_user.id,),
        )
    await conn.commit()
    return {"message": "Notificaciones eliminadas"}

