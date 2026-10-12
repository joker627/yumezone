# imports externos
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException

# imports locales
from app.modules.chapters.models import Chapter, ChapterImage
from app.modules.chapters.schemas import ChapterCreate, ChapterPageReference
from app.modules.chapters.repository import (
    ChapterImageRepository,
    ChapterRepository,
)
from app.utils.generate_slug import generate_slug


class ChapterService:
    def __init__(self):
        self.chapter_repository = ChapterRepository()
        self.chapter_image_repository = ChapterImageRepository()

    # Crear capítulo
    async def create_chapter(self, data: ChapterCreate) -> Chapter:
        if await self.get_chapter_by_number(data.work_id, data.chapter_number):
            raise HTTPException(status_code=409, detail="Ya existe ese número de capítulo en la obra")

        number = format(data.chapter_number.normalize(), "f").replace(".", "-")
        chapter = Chapter(
            **data.model_dump(),
            slug=generate_slug(f"work-{data.work_id}-chapter-{number}"),
        )
        return await self.chapter_repository.create_chapter(chapter)

    # Obtener capítulo por ID
    async def get_chapter_by_id(self, chapter_id: int) -> Optional[Chapter]:
        return await self.chapter_repository.get_chapter(chapter_id)

    # Obtener capítulo por número
    async def get_chapter_by_number(
        self, work_id: int, chapter_number: Decimal
    ) -> Optional[Chapter]:
        return await self.chapter_repository.get_chapter_by_number(
            work_id, chapter_number
        )

    # Obtener capítulos de una obra
    async def get_chapters(
        self,
        work_id: int,
        published_only: bool = False,
        order: str = "asc",
    ) -> List[Chapter]:
        return await self.chapter_repository.get_chapters(
            work_id, published_only=published_only, order=order
        )

    # Actualizar capítulo
    async def update_chapter(self, chapter_id: int, chapter_data: dict) -> Chapter:
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(
                status_code=404,
                detail="Capítulo no encontrado",
            )

        for key, value in chapter_data.items():
            if hasattr(chapter, key) and value is not None:
                setattr(chapter, key, value)

        return await self.chapter_repository.update_chapter(chapter)

    # Eliminar capítulo
    async def delete_chapter(self, chapter_id: int) -> bool:
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(
                status_code=404,
                detail="Capítulo no encontrado",
            )
        return await self.chapter_repository.delete_chapter(chapter_id)

    # Crear imágenes de un capítulo
    async def create_chapter_images(
        self, images: List[ChapterImage]
    ) -> List[ChapterImage]:
        return await self.chapter_image_repository.create_chapter_images(images)

    # Eliminar imágenes de un capítulo
    async def delete_chapter_images(self, chapter_id: int) -> bool:
        return await self.chapter_image_repository.delete_chapter_images(chapter_id)

    # Obtener imágenes de un capítulo
    async def get_chapter_images(self, chapter_id: int) -> List[ChapterImage]:
        return await self.chapter_image_repository.get_chapter_images(chapter_id)

    async def replace_chapter_page_references(
        self, chapter_id: int, pages: list[ChapterPageReference]
    ) -> List[ChapterImage]:
        orders = [page.order_number for page in pages]
        if len(orders) != len(set(orders)):
            raise HTTPException(status_code=422, detail="order_number no puede repetirse")

        images = [
            ChapterImage(
                chapter_id=chapter_id,
                image_url=page.image_url,
                order_number=page.order_number,
            )
            for page in sorted(pages, key=lambda page: page.order_number)
        ]
        return await self.chapter_image_repository.replace_chapter_images(chapter_id, images)
