# imports standard
from typing import List, Optional

# imports external
import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query

# imports internal
from app.core.database import get_db_connection
from app.core.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    verify_upload_permission,
)
from app.modules.chapters.schemas import (
    ChapterCreate,
    ChapterImageResponse,
    ChapterPagesReplace,
    ChapterResponse,
    ChapterUpdate,
)
from app.modules.chapters.services import ChapterService
from app.modules.users.models import CurrentUser
from app.modules.works.repository import WorkRepository
from app.modules.works.services import WorkService


def get_chapter_service():
    return ChapterService()


def get_work_service(
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    return WorkService(WorkRepository(conn))


async def _assert_can_read_chapter(chapter, current_user: Optional[CurrentUser]):
    if chapter.status.upper() == "PUBLISHED":
        return
    if current_user:
        if current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]:
            return
        if chapter.scan_group_id:
            try:
                await verify_upload_permission(current_user, chapter.scan_group_id)
                return
            except HTTPException:
                pass
    raise HTTPException(
        status_code=404,
        detail="Capítulo no encontrado",
    )


router = APIRouter()


# Obtener capitulos por ID de obra
@router.get(
    "/work/{work_id_or_slug}",
    response_model=List[ChapterResponse],
)
async def get_chapters(
    work_id_or_slug: str,
    published_only: bool = Query(True, description="Filtrar solo capítulos publicados"),
    order: str = Query("asc", description="Orden de número de capítulo: asc o desc"),
    service: ChapterService = Depends(get_chapter_service),
    work_service: WorkService = Depends(get_work_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    if work_id_or_slug.isdigit():
        actual_work_id = int(work_id_or_slug)
    else:
        work_obj = await work_service.get_work_by_slug(work_id_or_slug)
        if not work_obj:
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        actual_work_id = work_obj.id

    if not published_only:
        if not current_user:
            published_only = True
        elif current_user.platform_role.upper() not in ["ADMIN", "SUPERADMIN"]:
            try:
                work = await work_service.get_work_by_id(actual_work_id)
                await verify_upload_permission(current_user, work.scan_group_id)
            except HTTPException:
                published_only = True

    return await service.get_chapters(
        actual_work_id, published_only=published_only, order=order
    )


# Obtener capítulo por ID
@router.get("/{chapter_id}", response_model=ChapterResponse)
async def get_chapter_by_id(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Capítulo no encontrado",
        )
    await _assert_can_read_chapter(chapter, current_user)
    return chapter


# Crear capitulo
@router.post("/create_chapter", response_model=ChapterResponse)
async def create_chapter(
    chapter: ChapterCreate,
    service: ChapterService = Depends(get_chapter_service),
    work_service: WorkService = Depends(get_work_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    # 404 si la obra no existe; el permiso se evalúa sobre el grupo dueño de la obra,
    # nunca sobre el scan_group_id que manda el cliente en el body.
    work = await work_service.get_work_by_id(chapter.work_id)
    await verify_upload_permission(current_user, work.scan_group_id)
    return await service.create_chapter(chapter)


# Actualizar capítulo
@router.put("/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: int,
    chapter_data: ChapterUpdate,
    service: ChapterService = Depends(get_chapter_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Capítulo no encontrado",
        )

    await verify_upload_permission(current_user, chapter.scan_group_id)
    return await service.update_chapter(
        chapter_id, chapter_data.model_dump(exclude_unset=True)
    )


# Eliminar capítulo
@router.delete("/{chapter_id}", status_code=204)
async def delete_chapter(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Capítulo no encontrado",
        )

    await verify_upload_permission(current_user, chapter.scan_group_id)
    await service.delete_chapter(chapter_id)
    return None


# Registrar referencias de imágenes de un capítulo existente.
# Los binarios se alojan fuera de la API (Azure Blob/CDN u otro proveedor).
@router.put(
    "/{chapter_id}/pages",
    response_model=List[ChapterImageResponse],
)
async def replace_chapter_pages(
    chapter_id: int,
    payload: ChapterPagesReplace,
    service: ChapterService = Depends(get_chapter_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    # Verificamos si existe
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Capítulo no encontrado",
        )

    await verify_upload_permission(current_user, chapter.scan_group_id)

    return await service.replace_chapter_page_references(chapter_id, payload.pages)



# Obtener las imágenes (páginas) de un capítulo
@router.get(
    "/{chapter_id}/pages",
    response_model=List[ChapterImageResponse],
)
async def get_chapter_pages(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Capítulo no encontrado",
        )
    await _assert_can_read_chapter(chapter, current_user)

    return await service.get_chapter_images(chapter_id)

