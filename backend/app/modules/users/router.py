from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    invalidate_user_session,
)
from app.modules.users.schemas import CurrentUser
from app.modules.users.schemas import (
    UserProfileResponse,
    UserUpdate,
    UserSearchItem,
    UserCoinTransactionResponse,
    WalletExchangeRequest,
)
from app.modules.users.services import UserService

router = APIRouter(prefix="/users", tags=["Usuarios"])

# servicio de usuario con conexion inyectada
def get_user_service(conn: AsyncSession = Depends(get_db_session)) -> UserService:
    return UserService(conn)


# buscar usuarios por coincidencia
@router.get("/search", response_model=List[UserSearchItem])
async def search_users(
    q: str = Query(..., min_length=1),
    service: UserService = Depends(get_user_service)
):
    return await service.search_users(q)


# transacciones de monedas del usuario autenticado
@router.get("/me/transactions", response_model=List[UserCoinTransactionResponse])
async def get_my_coin_transactions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service: UserService = Depends(get_user_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    return await service.get_coin_transactions(current_user.id, limit=limit, offset=offset)


# intercambio bidireccional en cartera (YumeCoins <-> Cristales)
@router.post("/me/exchange")
async def exchange_my_wallet_currency(
    payload: WalletExchangeRequest,
    service: UserService = Depends(get_user_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    try:
        res = await service.exchange_currency(current_user.id, payload.direction, payload.amount)
        await invalidate_user_session(current_user.email)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



# obtener perfil por id, codigo o username
@router.get("/{identifier}", response_model=UserProfileResponse)
async def get_user_profile(
    identifier: str,
    service: UserService = Depends(get_user_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user)
):
    requester_id = current_user.id if current_user else None
    profile = await service.get_profile(identifier, requester_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return profile


# actualizar perfil del usuario autenticado
@router.put("/me", response_model=UserProfileResponse)
async def update_my_profile(
    data: UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    success = await service.update_profile(current_user.id, data)
    if not success:
        raise HTTPException(status_code=400, detail="Error actualizando el perfil")
    return await service.get_profile(str(current_user.id), current_user.id)



from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import get_current_active_user

from app.modules.users.schemas import (
    LibraryAdd,
    LibraryItem,
    LibraryStatusUpdate,
    LibraryWorkStatus,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    ReadingHistoryCreate,
    WorkRatingResponse,
    WorkRatingUpdate,
    MarkAllReadRequest,
)

from app.modules.users.schemas import CurrentUser

library_router = APIRouter(prefix="/library", tags=["Biblioteca"])

def get_library_service(
    conn: AsyncSession = Depends(get_db_session),
) -> UserService:
    return UserService(conn)


@library_router.get("/", response_model=list[LibraryItem])
async def list_library(
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    return await library_service.list_for_user(current_user.id)


@library_router.get("/{work_id}", response_model=LibraryWorkStatus)
async def get_library_work_status(
    work_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    item = await library_service.get_for_user(current_user.id, work_id)
    if not item or not item.get("library_status"):
        return {"in_library": False, "status": None, "item": None}
    return {
        "in_library": True,
        "status": item.get("library_status", "READING"),
        "item": item,
    }


@library_router.post("/history", status_code=status.HTTP_204_NO_CONTENT)
async def save_reading_history(
    history: ReadingHistoryCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    await library_service.save_reading_history(
        current_user.id,
        history.work_id,
        history.chapter_id,
        history.last_page_read or 1,
        completed=bool(history.completed),
    )
    return None


@library_router.post(
    "/{work_id}",
    response_model=LibraryItem,
    status_code=status.HTTP_201_CREATED,
)
async def add_to_library(
    work_id: int,
    item: LibraryAdd,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    return await library_service.add_work(current_user.id, work_id, item.status)


@library_router.patch("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_library_status(
    work_id: int,
    item: LibraryStatusUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    await library_service.update_status(current_user.id, work_id, item.status)
    return None


@library_router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_library(
    work_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    await library_service.remove_work(current_user.id, work_id)
    return None


@library_router.get(
    "/{work_id}/notifications",
    response_model=NotificationPreferenceResponse,
)
async def get_notification_preference(
    work_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    notify_new_chapters = await library_service.get_notification_preference(
        current_user.id, work_id
    )
    return {
        "work_id": work_id,
        "notify_new_chapters": notify_new_chapters,
    }


@library_router.patch(
    "/{work_id}/notifications",
    response_model=NotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
)
async def update_notification_preference(
    work_id: int,
    preference: NotificationPreferenceUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
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


@library_router.post(
    "/{work_id}/rating",
    response_model=WorkRatingResponse,
    status_code=status.HTTP_200_OK,
)
async def rate_work(
    work_id: int,
    rating_data: WorkRatingUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    return await library_service.set_work_rating(
        current_user.id, work_id, rating_data.rating
    )


@library_router.get(
    "/{work_id}/rating",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def get_user_rating(
    work_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    rating = await library_service.get_user_work_rating(current_user.id, work_id)
    return {"work_id": work_id, "user_rating": rating}


@library_router.get(
    "/works/{work_id}/read-chapters",
    response_model=List[int],
    status_code=status.HTTP_200_OK,
)
async def get_read_chapters(
    work_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    return await library_service.get_user_read_chapters(current_user.id, work_id)


@library_router.post(
    "/chapters/{chapter_id}/read-toggle",
    status_code=status.HTTP_200_OK,
)
async def toggle_chapter_read(
    chapter_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    return await library_service.toggle_chapter_read(current_user.id, chapter_id)


@library_router.post(
    "/works/{work_id}/mark-all-read",
    status_code=status.HTTP_200_OK,
)
async def mark_all_chapters_read(
    work_id: int,
    payload: MarkAllReadRequest,
    current_user: CurrentUser = Depends(get_current_active_user),
    library_service: UserService = Depends(get_library_service),
):
    return await library_service.mark_all_read(current_user.id, work_id, payload.read)

