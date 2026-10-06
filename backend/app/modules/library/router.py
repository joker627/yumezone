import aiomysql

from fastapi import APIRouter, Depends, status

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.library.repository import LibraryRepository
from app.modules.library.schemas import (
    LibraryAdd,
    LibraryItem,
    LibraryStatusUpdate,
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


@router.get("/", response_model=list[LibraryItem])
async def list_library(
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: LibraryService = Depends(get_library_service),
):
    return await library_service.list_for_user(current_user.id)


@router.post(
    "/{work_id}",
    response_model=LibraryItem,
    status_code=status.HTTP_201_CREATED,
)
async def add_to_library(
    work_id: int,
    item: LibraryAdd,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: LibraryService = Depends(get_library_service),
):
    return await library_service.add_work(current_user.id, work_id, item.status)


@router.patch("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_library_status(
    work_id: int,
    item: LibraryStatusUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: LibraryService = Depends(get_library_service),
):
    await library_service.update_status(current_user.id, work_id, item.status)
    return None


@router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_library(
    work_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: LibraryService = Depends(get_library_service),
):
    await library_service.remove_work(current_user.id, work_id)
    return None


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
