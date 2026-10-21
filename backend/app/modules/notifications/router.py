from typing import Annotated
import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.services import NotificationService
from app.modules.users.models import CurrentUser

router = APIRouter()


def get_notification_service(
    conn: aiomysql.Connection = Depends(get_db_connection),
) -> NotificationService:
    repository = NotificationRepository(conn)
    return NotificationService(repository)


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: NotificationService = Depends(get_notification_service),
):
    return await service.list_for_user(current_user.id, unread_only=unread_only, limit=limit)


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: NotificationService = Depends(get_notification_service),
):
    success = await service.mark_read(notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return None


@router.patch("/read-all")
@router.patch("/read-all/")
async def mark_all_read(
    current_user: CurrentUser = Depends(get_current_active_user),
    service: NotificationService = Depends(get_notification_service),
):
    await service.mark_all_read(current_user.id)
    return {"message": "Todas las notificaciones marcadas como leídas"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: NotificationService = Depends(get_notification_service),
):
    success = await service.delete_notification(notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return None
