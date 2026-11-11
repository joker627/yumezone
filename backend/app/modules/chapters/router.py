from decimal import Decimal
from types import SimpleNamespace
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    verify_scan_manage_permission,
    verify_scan_member_permission,
    verify_upload_permission,
)
from app.modules.chapters.schemas import (
    ChapterCreate,
    ChapterImageResponse,
    ChapterPagesReplace,
    ChapterReaderResponse,
    ChapterResponse,
    ChapterSubmissionCreate,
    ChapterSubmissionResponse,
    ChapterSubmissionReview,
    ChapterUpdate,
)
from app.modules.chapters.services import ChapterService
from app.modules.users.schemas import CurrentUser
from app.modules.series.repository import WorkRepository
from app.modules.series.services import WorkService


router = APIRouter(prefix="/chapters", tags=["Capítulos"])


def get_chapter_service(
    conn: AsyncSession = Depends(get_db_session),
) -> ChapterService:
    return ChapterService(conn)


def get_work_service(
    conn: AsyncSession = Depends(get_db_session),
) -> WorkService:
    return WorkService(WorkRepository(conn))


async def _assert_can_read_chapter(
    chapter,
    current_user: Optional[CurrentUser],
    conn: Optional[AsyncSession] = None,
):
    if chapter.status.upper() == "PUBLISHED":
        return
    if current_user:
        if current_user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]:
            return
        if chapter.scan_group_id:
            try:
                await verify_scan_member_permission(current_user, chapter.scan_group_id, conn=conn)
                return
            except HTTPException:
                pass
    raise HTTPException(
        status_code=404,
        detail="Capítulo no encontrado",
    )


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
                await verify_scan_member_permission(current_user, work.scan_group_id, conn=work_service.repository.conn)
            except HTTPException:
                published_only = True

    return await service.get_chapters(
        actual_work_id, published_only=published_only, order=order
    )


# Lector consolidado de capítulos (búsqueda por chapter_id o por work_slug + chapter_number)
@router.get("/reader", response_model=ChapterReaderResponse)
async def get_chapter_reader(
    chapter_id: Optional[int] = Query(default=None, description="ID del capítulo"),
    work_slug: Optional[str] = Query(default=None, description="Slug de la obra"),
    chapter_number: Optional[Decimal] = Query(default=None, description="Número de capítulo"),
    service: ChapterService = Depends(get_chapter_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    if not chapter_id and not work_slug:
        raise HTTPException(status_code=400, detail="Debe proporcionar chapter_id o work_slug")

    user_id = current_user.id if current_user else None
    data = await service.get_chapter_reader(
        chapter_id=chapter_id,
        work_slug=work_slug,
        chapter_number=chapter_number,
        user_id=user_id,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Capítulo u obra no encontrado")

    status_str = (data["chapter"].get("status") or "").upper()
    if status_str != "PUBLISHED":
        dummy_ch = SimpleNamespace(
            status=status_str,
            scan_group_id=data["chapter"].get("scan_group_id"),
        )
        await _assert_can_read_chapter(dummy_ch, current_user, conn=service.chapter_repository.conn)

    return data


# Lector consolidado por ID directo de capítulo
@router.get("/{chapter_id}/reader", response_model=ChapterReaderResponse)
async def get_chapter_reader_by_id(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    user_id = current_user.id if current_user else None
    data = await service.get_chapter_reader(
        chapter_id=chapter_id,
        user_id=user_id,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Capítulo no encontrado")

    status_str = (data["chapter"].get("status") or "").upper()
    if status_str != "PUBLISHED":
        dummy_ch = SimpleNamespace(
            status=status_str,
            scan_group_id=data["chapter"].get("scan_group_id"),
        )
        await _assert_can_read_chapter(dummy_ch, current_user, conn=service.chapter_repository.conn)

    return data


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
    await _assert_can_read_chapter(chapter, current_user, conn=service.chapter_repository.conn)
    return chapter


# Crear capitulo
@router.post("/create_chapter", response_model=ChapterResponse)
async def create_chapter(
    chapter: ChapterCreate,
    service: ChapterService = Depends(get_chapter_service),
    work_service: WorkService = Depends(get_work_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    work = await work_service.get_work_by_id(chapter.work_id)
    await verify_upload_permission(current_user, work.scan_group_id, conn=work_service.repository.conn)
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

    await verify_upload_permission(current_user, chapter.scan_group_id, conn=service.chapter_repository.conn)
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

    await verify_scan_manage_permission(current_user, chapter.scan_group_id, conn=service.chapter_repository.conn)
    await service.delete_chapter(chapter_id)
    return None


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
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Capítulo no encontrado",
        )

    await verify_upload_permission(current_user, chapter.scan_group_id, conn=service.chapter_repository.conn)

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
    await _assert_can_read_chapter(chapter, current_user, conn=service.chapter_repository.conn)

    return await service.get_chapter_images(chapter_id)


@router.post(
    "/{chapter_id}/submissions",
    status_code=201,
)
async def submit_translation(
    chapter_id: int,
    payload: ChapterSubmissionCreate,
    service: ChapterService = Depends(get_chapter_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    return await service.submit_translation(chapter_id, current_user, payload)


@router.get(
    "/{chapter_id}/submissions",
    response_model=List[ChapterSubmissionResponse],
)
async def list_submissions(
    chapter_id: int,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    service: ChapterService = Depends(get_chapter_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    return await service.list_submissions(chapter_id, current_user, status_filter)


@router.patch(
    "/{chapter_id}/submissions/{submission_id}",
)
async def review_submission(
    chapter_id: int,
    submission_id: int,
    payload: ChapterSubmissionReview,
    service: ChapterService = Depends(get_chapter_service),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    return await service.review_submission(chapter_id, submission_id, current_user, payload)

