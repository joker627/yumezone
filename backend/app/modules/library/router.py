import aiomysql

from fastapi import APIRouter, Depends, status

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.library.repository import LibraryRepository
from app.modules.library.schemas import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)
from app.modules.library.services import LibraryService
from app.modules.users.models import CurrentUser

router = APIRouter(tags=["Library"])


def get_library_service(
    conn: aiomysql.Connection = Depends(get_db_connection),
) -> LibraryService:
    return LibraryService(LibraryRepository(conn))


@router.get(
    "/{work_id}/notifications",
    response_model=NotificationPreferenceResponse,
)
async def get_notification_preference(
    work_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: LibraryService = Depends(get_library_service),
):
    notify_new_chapters = await library_service.get_notification_preference(
        current_user.id, work_id
    )
    return {
        "work_id": work_id,
        "notify_new_chapters": notify_new_chapters,
    }


@router.patch(
    "/{work_id}/notifications",
    response_model=NotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
)
async def update_notification_preference(
    work_id: int,
    preference: NotificationPreferenceUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: LibraryService = Depends(get_library_service),
):
    notify_new_chapters = await library_service.update_notification_preference(
        current_user.id,
        work_id,
        preference.notify_new_chapters,
    )
    return {
        "work_id": work_id,
        "notify_new_chapters": notify_new_chapters,
    }
