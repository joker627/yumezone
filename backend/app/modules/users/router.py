from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.dependencies import get_current_active_user, get_optional_current_user
from app.modules.users.models import CurrentUser
from app.modules.users.schemas import UserProfileResponse, UserUpdate, UserSearchItem
from app.modules.users.services import UserService

router = APIRouter()

def get_user_service():
    return UserService()


@router.get("/search", response_model=List[UserSearchItem])
async def search_users(
    q: str = Query(..., min_length=1),
    service: UserService = Depends(get_user_service)
):
    """
    Busca usuarios por username o código. 
    Se puede usar un prefijo '@' en el front y mandarlo limpio o con '@'.
    Este buscador está separado del buscador de obras.
    """
    return await service.search_users(q)


@router.get("/{identifier}", response_model=UserProfileResponse)
async def get_user_profile(
    identifier: str,
    service: UserService = Depends(get_user_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user)
):
    """Obtiene el perfil de un usuario (por ID, código o username)."""
    requester_id = current_user.id if current_user else None
    profile = await service.get_profile(identifier, requester_id)
    
    if not profile:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    return profile


@router.put("/me", response_model=UserProfileResponse)
async def update_my_profile(
    data: UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Permite a un usuario editar su propio perfil."""
    # Validación extra de que el username no esté en uso por otro
    # (podría añadirse en el service si se modifica el username)
    success = await service.update_profile(current_user.id, data)
    if not success:
        raise HTTPException(status_code=400, detail="Error actualizando el perfil")
        
    return await service.get_profile(str(current_user.id), current_user.id)
