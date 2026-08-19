# imports external
from fastapi import APIRouter, Depends, status

# imports internal
from app.modules.auth.schemas import UserBase, UserCreate, UserLogin, Token, UserUpdate
from app.modules.auth.services import AuthService
from app.modules.auth.repository import AuthRepository
from app.modules.users.models import User
from app.core.dependencies import get_current_user, get_current_active_user

router = APIRouter(tags=["Auth"])

# dependencias del endpoint router
def get_auth_service():
    repository = AuthRepository()
    return AuthService(repository)

# endpoint registrar usuario
@router.post("/register", response_model=UserBase, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserCreate, 
    auth_service: AuthService = Depends(get_auth_service)
):
    new_user = await auth_service.register(user_data)
    return new_user

# endpoint iniciar sesión
@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
async def login_user(
    user_credentials: UserLogin, 
    auth_service: AuthService = Depends(get_auth_service)
):
    access_token = await auth_service.login(user_credentials)
    return {"access_token": access_token, 
            "token_type": "bearer"}

# endpoint obtener usuario actual
@router.get("/me", response_model=UserBase, status_code=status.HTTP_200_OK)
async def get_me(
    current_user: User = Depends(get_current_active_user)
):
    return current_user

# actualizar datos del usuario
@router.patch("/me", response_model=UserBase, status_code=status.HTTP_200_OK)
async def update_me(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    updated_user = await auth_service.update_profile(current_user, update_data)
    return updated_user
