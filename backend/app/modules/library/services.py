from fastapi import HTTPException

from app.modules.library.repository import LibraryRepository


class LibraryService:
    def __init__(self, repository: LibraryRepository):
        self.repository = repository

    async def list_for_user(self, user_id: int):
        return await self.repository.list_for_user(user_id)

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
            raise HTTPException(
                status_code=404,
                detail="La obra no está en tu biblioteca",
            )
        return notify_new_chapters
