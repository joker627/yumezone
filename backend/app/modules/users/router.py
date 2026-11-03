from typing import List, Optional
import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user, get_optional_current_user
from app.modules.users.models import CurrentUser
from app.modules.users.schemas import (
    UserProfileResponse,
    UserUpdate,
    UserSearchItem,
    UserCoinTransactionResponse,
)
from app.modules.users.services import UserService

router = APIRouter(prefix="/users", tags=["Usuarios"])

# servicio de usuario con conexion inyectada
def get_user_service(conn: aiomysql.Connection = Depends(get_db_connection)) -> UserService:
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

