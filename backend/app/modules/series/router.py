# imports external
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Optional

# imports internal
from app.core.database import get_db_session
from app.core.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    verify_scan_manage_permission,
    verify_upload_permission,
)
from app.modules.users.schemas import CurrentUser
from app.modules.series.repository import WorkRepository
from app.modules.series.schemas import (
    WorkDetailResponse,
    WorkFiltersResponse,
    WorkCreate,
    WorkPaginatedResponse,
    WorkResponse,
    WorkUpdate,
)
from app.modules.series.services import WorkService

router = APIRouter(prefix="/works", tags=["Series"])
series_alias_router = APIRouter(prefix="/series", tags=["Series"])



# dependencias del endpoint router
def get_work_service(
    conn: AsyncSession = Depends(get_db_session),
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
    await verify_scan_manage_permission(current_user, work_data.scan_group_id, conn=work_service.repository.conn)
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

    await verify_scan_manage_permission(current_user, work.scan_group_id, conn=work_service.repository.conn)
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

    await verify_scan_manage_permission(current_user, work.scan_group_id, conn=work_service.repository.conn)
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


# sugerencias de busqueda unificadas (obras y usuarios)
@router.get(
    "/search/suggest",
    status_code=status.HTTP_200_OK,
)
async def get_search_suggestions(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(7, ge=1, le=20),
    work_service: WorkService = Depends(get_work_service),
):
    return await work_service.get_search_suggestions(q, limit=limit)


# endpoint obtener detalle consolidado de obra (obra + capítulos + estado de lectura y biblioteca)
@router.get(
    "/{slug_or_id}/detail",
    response_model=WorkDetailResponse,
    status_code=status.HTTP_200_OK,
)
async def get_work_detail(
    slug_or_id: str,
    work_service: WorkService = Depends(get_work_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    user_id = current_user.id if current_user else None
    return await work_service.get_work_detail(slug_or_id, user_id=user_id)


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

