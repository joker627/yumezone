from typing import List, Optional
from fastapi import HTTPException

from app.modules.library.repository import LibraryRepository


class LibraryService:
    def __init__(self, repository: LibraryRepository):
        self.repository = repository

    async def list_for_user(self, user_id: int):
        return await self.repository.list_for_user(user_id)

    async def get_for_user(self, user_id: int, work_id: int):
        return await self.repository.get_for_user(user_id, work_id)

    async def add_work(self, user_id: int, work_id: int, status: str):
        if not await self.repository.work_exists(work_id):
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        await self.repository.add_work(user_id, work_id, status)
        item = await self.repository.get_for_user(user_id, work_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        return item

    async def update_status(self, user_id: int, work_id: int, status: str) -> None:
        if not await self.repository.update_status(user_id, work_id, status):
            raise HTTPException(
                status_code=404,
                detail="La obra no pertenece a tu biblioteca",
            )

    async def remove_work(self, user_id: int, work_id: int) -> None:
        if not await self.repository.remove_work(user_id, work_id):
            raise HTTPException(
                status_code=404,
                detail="La obra no pertenece a tu biblioteca",
            )

    async def get_notification_preference(self, user_id: int, work_id: int) -> bool:
        preference = await self.repository.get_notification_preference(user_id, work_id)
        if preference is None:
            raise HTTPException(
                status_code=404,
                detail="La obra no está en tu biblioteca",
            )
        return preference

    async def update_notification_preference(
        self, user_id: int, work_id: int, notify_new_chapters: bool
    ) -> bool:
        updated = await self.repository.update_notification_preference(
            user_id, work_id, notify_new_chapters
        )
        if not updated:
            if notify_new_chapters:
                await self.repository.add_work(user_id, work_id, "FOLLOWING")
                await self.repository.update_notification_preference(user_id, work_id, True)
                return True
            raise HTTPException(
                status_code=404,
                detail="La obra no está en tu biblioteca",
            )
        return notify_new_chapters

    async def save_reading_history(
        self, user_id: int, work_id: int, chapter_id: int, page: int
    ) -> None:
        total_pages = await self.repository.get_chapter_page_count(work_id, chapter_id)
        if total_pages is None:
            raise HTTPException(status_code=404, detail="El capítulo no pertenece a la obra indicada")
        if total_pages and page > total_pages:
            raise HTTPException(status_code=422, detail="La página indicada no existe en el capítulo")
        await self.repository.save_reading_history(user_id, work_id, chapter_id, page)

    async def set_work_rating(self, user_id: int, work_id: int, rating: float):
        if rating < 0.5 or rating > 10.0:
            raise HTTPException(status_code=422, detail="La calificación debe estar entre 0.5 y 10.0")
        if not await self.repository.work_exists(work_id):
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        return await self.repository.set_work_rating(user_id, work_id, rating)

    async def get_user_work_rating(self, user_id: int, work_id: int):
        return await self.repository.get_user_work_rating(user_id, work_id)

    async def get_user_read_chapters(self, user_id: int, work_id: int) -> List[int]:
        return await self.repository.get_user_read_chapters(user_id, work_id)

    async def toggle_chapter_read(self, user_id: int, chapter_id: int) -> dict:
        try:
            return await self.repository.toggle_chapter_read(user_id, chapter_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
