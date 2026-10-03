from fastapi import HTTPException

from app.modules.library.repository import LibraryRepository


class LibraryService:
    def __init__(self, repository: LibraryRepository):
        self.repository = repository

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
