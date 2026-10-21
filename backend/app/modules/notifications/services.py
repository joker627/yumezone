from typing import Any, Dict, List
from app.modules.notifications.repository import NotificationRepository


class NotificationService:
    def __init__(self, repository: NotificationRepository):
        self.repo = repository

    async def list_for_user(
        self, user_id: int, unread_only: bool = False, limit: int = 30
    ) -> List[Dict[str, Any]]:
        return await self.repo.list_for_user(user_id, unread_only=unread_only, limit=limit)

    async def mark_read(self, notification_id: int, user_id: int) -> bool:
        return await self.repo.mark_read(notification_id, user_id)

    async def mark_all_read(self, user_id: int) -> None:
        await self.repo.mark_all_read(user_id)

    async def delete_notification(self, notification_id: int, user_id: int) -> bool:
        return await self.repo.delete_notification(notification_id, user_id)
