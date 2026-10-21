from typing import Any, Dict, List, Optional
from app.modules.home.repository import HomeRepository


class HomeService:
    def __init__(self, repository: HomeRepository):
        self.repo = repository

    async def get_launches(self, filter_format: Optional[str] = None, limit: int = 6) -> List[Dict[str, Any]]:
        return await self.repo.get_launches(filter_format=filter_format, limit=limit)

    async def get_ranking(self, period: str = "weekly", limit: int = 6) -> List[Dict[str, Any]]:
        return await self.repo.get_ranking(period=period, limit=limit)

    async def get_popular(self, format: Optional[str] = None, limit: int = 4) -> List[Dict[str, Any]]:
        return await self.repo.get_popular(format=format, limit=limit)

    async def get_announcements(self, filter_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return await self.repo.get_announcements(filter_type=filter_type)

    async def get_continue_reading(self, user_id: int) -> List[Dict[str, Any]]:
        return await self.repo.get_continue_reading(user_id=user_id)

    async def get_missions(self, user_id: int) -> Dict[str, Any]:
        return await self.repo.get_missions(user_id=user_id)

    async def claim_mission(self, user_id: int, mission_key: str) -> Dict[str, Any]:
        return await self.repo.claim_mission(user_id=user_id, mission_key=mission_key)
