# Imports externos
from typing import List
# Imports locales
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.modules.chapters.services import ChapterService
from app.modules.chapters.schemas import ChapterResponse, ChapterCreate, ChapterImageResponse, ChapterUpdate
from app.core.dependencies import get_current_active_user, verify_upload_permission
from app.modules.users.models import User

def get_chapter_service():
    return ChapterService()

router = APIRouter(prefix="/chapters", tags=["chapters"])

# Obtener capitulos por ID de obra
@router.get("/work/{work_id}", response_model=List[ChapterResponse])
async def get_chapters(work_id: int, service: ChapterService = Depends(get_chapter_service)):
    return await service.get_chapters(work_id)

# Crear capitulo
@router.post("/create_chapter", response_model=ChapterResponse)
async def create_chapter(
    chapter: ChapterCreate, 
    service: ChapterService = Depends(get_chapter_service),
    current_user: User = Depends(get_current_active_user)
):
    await verify_upload_permission(current_user, chapter.scan_group_id)
    return await service.create_chapter(chapter)

# Actualizar capítulo
@router.put("/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: int,
    chapter_data: ChapterUpdate,
    service: ChapterService = Depends(get_chapter_service),
    current_user: User = Depends(get_current_active_user)
):
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Capítulo no encontrado")
        
    await verify_upload_permission(current_user, chapter.scan_group_id)
    return await service.update_chapter(chapter_id, chapter_data.model_dump(exclude_unset=True))

# Eliminar capítulo
@router.delete("/{chapter_id}", status_code=204)
async def delete_chapter(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service),
    current_user: User = Depends(get_current_active_user)
):
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Capítulo no encontrado")
        
    await verify_upload_permission(current_user, chapter.scan_group_id)
    await service.delete_chapter(chapter_id)
    return None

# Subir imágenes a un capítulo existente
@router.post("/{chapter_id}/upload_pages", response_model=List[ChapterImageResponse])
async def upload_chapter_pages(
    chapter_id: int,
    files: List[UploadFile] = File(...),
    service: ChapterService = Depends(get_chapter_service),
    current_user: User = Depends(get_current_active_user)
):
    # Verificamos si existe
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Capítulo no encontrado")
        
    await verify_upload_permission(current_user, chapter.scan_group_id)
    
    # Procesar imágenes
    return await service.process_and_save_images(chapter_id, files)

# Obtener las imágenes (páginas) de un capítulo
@router.get("/{chapter_id}/pages", response_model=List[ChapterImageResponse])
async def get_chapter_pages(
    chapter_id: int, 
    service: ChapterService = Depends(get_chapter_service)
):
    chapter = await service.get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Capítulo no encontrado")
        
    return await service.get_chapter_images(chapter_id)
