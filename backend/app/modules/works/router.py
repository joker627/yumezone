# imports standard
import aiomysql

# imports external
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

# imports internal
from app.core.database import get_db_connection
from app.core.dependencies import (
    get_current_active_user,
    verify_upload_permission,
)
from app.modules.users.models import CurrentUser
from app.modules.works.repository import WorkRepository
from app.modules.works.schemas import (
    WorkFiltersResponse,
    WorkCreate,
    WorkPaginatedResponse,
    WorkResponse,
    WorkUpdate,
)
from app.modules.works.services import WorkService

router = APIRouter(tags=["Works"])


# dependencias del endpoint router
def get_work_service(
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    repo = WorkRepository(conn)
    return WorkService(repo)


# endpoint crear obra
@router.post(
    "/",
    response_model=WorkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_work(
    work_data: WorkCreate,
    work_service: WorkService = Depends(get_work_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    await verify_upload_permission(current_user, work_data.scan_group_id)
    new_work = await work_service.create_work(work_data)
    return new_work


# endpoint editar obra
@router.put(
    "/{work_id}",
    response_model=WorkResponse,
    status_code=status.HTTP_200_OK,
)
async def update_work(
    work_id: int,
    work_data: WorkUpdate,
    work_service: WorkService = Depends(get_work_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    # Verificar si la obra existe para obtener su scan_group_id
    work = await work_service.get_work_by_id(work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Obra no encontrada")

    await verify_upload_permission(current_user, work.scan_group_id)
    return await work_service.update_work(
        work_id, work_data.model_dump(exclude_unset=True)
    )


# endpoint eliminar obra
@router.delete(
    "/{work_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_work(
    work_id: int,
    work_service: WorkService = Depends(get_work_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    work = await work_service.get_work_by_id(work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Obra no encontrada")

    # Verificar permisos (Superadmin o Admin/Moderador del scan_group)
    await verify_upload_permission(current_user, work.scan_group_id)

    await work_service.delete_work(work_id)
    return None


# endpoint obtener todas las obras (con paginación)
@router.get(
    "/",
    response_model=WorkPaginatedResponse,
    status_code=status.HTTP_200_OK,
)
async def get_all_works(
    page: int = Query(1, ge=1, description="Número de página"),
    per_page: int = Query(
        25,
        ge=1,
        le=100,
        description="Cantidad de obras por página",
    ),
    q: str | None = Query(
        None,
        min_length=1,
        max_length=120,
        description="Busca en títulos, autor, sinopsis, géneros, etiquetas y capítulos",
    ),
    format_id: list[int] | None = Query(None),
    status_id: list[int] | None = Query(None),
    demographic_id: list[int] | None = Query(None),
    genre_id: list[int] | None = Query(None),
    sort: str = Query("relevance", pattern="^(relevance|popular|recent|title)$"),
    work_service: WorkService = Depends(get_work_service),
):
    return await work_service.get_all_works(
        page,
        per_page,
        q,
        format_id=format_id,
        status_id=status_id,
        demographic_id=demographic_id,
        genre_id=genre_id,
        sort=sort,
    )


@router.get(
    "/filters",
    response_model=WorkFiltersResponse,
    status_code=status.HTTP_200_OK,
)
async def get_work_filters(
    work_service: WorkService = Depends(get_work_service),
):
    return await work_service.get_filters()


# endpoint obtener obra por slug
@router.get(
    "/{slug}",
    response_model=WorkResponse,
    status_code=status.HTTP_200_OK,
)
async def get_work_by_slug(
    slug: str,
    work_service: WorkService = Depends(get_work_service),
):
    return await work_service.get_work_by_slug(slug)
