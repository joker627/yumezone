# imports externos
import datetime
# imports locales
from app.modules.chapters.repository import ChapterRepository, ChapterImageRepository
from app.modules.chapters.models import Chapter, ChapterImage
from typing import Optional, List
import os
import shutil
from fastapi import UploadFile

class ChapterService:
    def __init__(self):
        self.chapter_repository = ChapterRepository()
        self.chapter_image_repository = ChapterImageRepository()
    
    # Crear capítulo
    async def create_chapter(self, chapter: Chapter) -> Chapter:
        return await self.chapter_repository.create_chapter(chapter)
    
    # Obtener capítulo por ID
    async def get_chapter_by_id(self, chapter_id: int) -> Optional[Chapter]:
        return await self.chapter_repository.get_chapter(chapter_id)
    
    # Obtener capítulo por número
    async def get_chapter_by_number(self, work_id: int, chapter_number: float) -> Optional[Chapter]:
        return await self.chapter_repository.get_chapter_by_number(work_id, chapter_number)
    
    # Obtener capítulos de una obra
    async def get_chapters(self, work_id: int) -> List[Chapter]:
        return await self.chapter_repository.get_chapters(work_id)
    
    # Actualizar capítulo
    async def update_chapter(self, chapter_id: int, chapter_data: dict) -> Chapter:
        from fastapi import HTTPException
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Capítulo no encontrado")
            
        for key, value in chapter_data.items():
            if hasattr(chapter, key) and value is not None:
                setattr(chapter, key, value)
                
        return await self.chapter_repository.update_chapter(chapter)
    
    # Eliminar capítulo
    async def delete_chapter(self, chapter_id: int) -> bool:
        from fastapi import HTTPException
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Capítulo no encontrado")
        return await self.chapter_repository.delete_chapter(chapter_id)
    
    # Crear imágenes de un capítulo
    async def create_chapter_images(self, images: List[ChapterImage]) -> List[ChapterImage]:
        return await self.chapter_image_repository.create_chapter_images(images)
    
    # Eliminar imágenes de un capítulo
    async def delete_chapter_images(self, chapter_id: int) -> bool:
        return await self.chapter_image_repository.delete_chapter_images(chapter_id)
    
    # Obtener imágenes de un capítulo
    async def get_chapter_images(self, chapter_id: int) -> List[ChapterImage]:
        return await self.chapter_image_repository.get_chapter_images(chapter_id)

    # ==========================================
    # LÓGICA DE NEGOCIO: SUBIDA DE ARCHIVOS
    # ==========================================
    async def process_and_save_images(self, chapter_id: int, files: List[UploadFile]) -> List[ChapterImage]:
        # 1. Definir la ruta física donde se guardarán las imágenes (ej. uploads/chapters/5/)
        upload_dir = f"uploads/chapters/{chapter_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        chapter_images_to_db = []
        
        # 2. Guardar cada archivo físico y generar la ruta de la base de datos
        for index, file in enumerate(files):
            # order_number empieza en 1
            order = index + 1
            
            # Nombre de archivo seguro: ej. "1_imagen.png"
            file_name = f"{order}_{file.filename}"
            file_path = os.path.join(upload_dir, file_name)
            
            # Guardar el archivo en el disco
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # La URL que guardamos en la base de datos (relativa)
            # En el frontend se verá como: https://tu-api.com/uploads/chapters/5/1_imagen.png
            image_url = f"/uploads/chapters/{chapter_id}/{file_name}"
            
            # Crear el objeto modelo
            chapter_image = ChapterImage(
                chapter_id=chapter_id,
                image_url=image_url,
                order_number=order
            )
            chapter_images_to_db.append(chapter_image)
            
        # 3. Guardar masivamente en la base de datos usando el repositorio
        if chapter_images_to_db:
            await self.create_chapter_images(chapter_images_to_db)
            
        return chapter_images_to_db
