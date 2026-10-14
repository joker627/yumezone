from typing import Annotated

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.notifications.repository import NotificationRepository
from app.modules.users.models import CurrentUser

router = APIRouter()


def get_notification_repository(
    conn: aiomysql.Connection = Depends(get_db_connection),
) -> NotificationRepository:
    return NotificationRepository(conn)


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    current_user: CurrentUser = Depends(get_current_active_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    return await repo.list_for_user(current_user.id, unread_only=unread_only, limit=limit)


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    success = await repo.mark_read(notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return None


@router.patch("/read-all")
async def mark_all_read(
    current_user: CurrentUser = Depends(get_current_active_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    await repo.mark_all_read(current_user.id)
    return None


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    success = await repo.delete_notification(notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return None


@router.delete("/")
async def clear_notifications(
    current_user: CurrentUser = Depends(get_current_active_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    await repo.clear_notifications(current_user.id)
    return {"message": "Notificaciones eliminadas"}

