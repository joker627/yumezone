# imports standard
from typing import List

# imports external
from fastapi import APIRouter, Depends, status, Query

# imports internal
from app.modules.works.schemas import WorkCreate, WorkResponse, WorkPaginatedResponse, WorkUpdate
from app.modules.works.services import WorkService
from app.core.dependencies import get_current_active_user, verify_upload_permission
from app.modules.users.models import User
from fastapi import HTTPException

router = APIRouter(tags=["Works"])

# dependencias del endpoint router
def get_work_service():
    return WorkService()

# endpoint crear obra
@router.post("/", response_model=WorkResponse, status_code=status.HTTP_201_CREATED)
async def create_work(
    work_data: WorkCreate, 
    work_service: WorkService = Depends(get_work_service),
    current_user: User = Depends(get_current_active_user)
):
    await verify_upload_permission(current_user, work_data.scan_group_id)
    new_work = await work_service.create_work(work_data)
    return new_work

# endpoint editar obra
@router.put("/{work_id}", response_model=WorkResponse, status_code=status.HTTP_200_OK)
async def update_work(
    work_id: int,
    work_data: WorkUpdate,
    work_service: WorkService = Depends(get_work_service),
    current_user: User = Depends(get_current_active_user)
):
    # Verificar si la obra existe para obtener su scan_group_id
    work = await work_service.get_work_by_id(work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Obra no encontrada")
        
    await verify_upload_permission(current_user, work.scan_group_id)
    return await work_service.update_work(work_id, work_data.model_dump(exclude_unset=True))

# endpoint eliminar obra
@router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work(
    work_id: int,
    work_service: WorkService = Depends(get_work_service),
    current_user: User = Depends(get_current_active_user)
):
    work = await work_service.get_work_by_id(work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Obra no encontrada")
        
    # Verificar permisos (Superadmin o Admin/Moderador del scan_group)
    await verify_upload_permission(current_user, work.scan_group_id)
    
    await work_service.delete_work(work_id)
    return None

# endpoint obtener todas las obras (con paginación)
@router.get("/", response_model=WorkPaginatedResponse, status_code=status.HTTP_200_OK)
async def get_all_works(
    page: int = Query(1, ge=1, description="Número de página"),
    per_page: int = Query(25, ge=1, le=100, description="Cantidad de obras por página"),
    work_service: WorkService = Depends(get_work_service)
):
    return await work_service.get_all_works(page, per_page)

# endpoint obtener obra por slug
@router.get("/{slug}", response_model=WorkResponse, status_code=status.HTTP_200_OK)
async def get_work_by_slug(slug: str, work_service: WorkService = Depends(get_work_service)):
    return await work_service.get_work_by_slug(slug)

