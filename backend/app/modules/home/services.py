import asyncio
from typing import Any, Dict, List, Optional
from app.core.redis import cached_query
from app.modules.home.repository import HomeRepository


class HomeService:
    def __init__(self, repository: HomeRepository):
        self.repo = repository

    # feed consolidado del home (consultas paralelas y caché distribuida)
    async def get_home_feed(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        default_missions = {
            "auth_required": True,
            "description": "Inicia sesión para ver tus misiones diarias.",
            "missions": [],
        }

        async def _empty_list() -> List[Dict[str, Any]]:
            return []

        async def _guest_missions() -> Dict[str, Any]:
            return default_missions

        (
            launches,
            ranking,
            popular,
            announcements,
            continue_reading,
            missions,
        ) = await asyncio.gather(
            self.get_launches(limit=6),
            self.get_ranking(period="all", limit=6),
            self.get_popular(limit=4),
            self.get_announcements(),
            self.get_continue_reading(user_id) if user_id else _empty_list(),
            self.get_missions(user_id) if user_id else _guest_missions(),
        )

        return {
            "continue_reading": continue_reading,
            "launches": launches,
            "ranking": ranking,
            "popular": popular,
            "announcements": announcements,
            "missions": missions,
        }

    # obtener lanzamientos recientes con cache
    async def get_launches(self, filter_format: Optional[str] = None, limit: int = 6) -> List[Dict[str, Any]]:
        cache_key = f"yume:cache:home:launches:{filter_format or 'all'}:{limit}"
        return await cached_query(
            cache_key, lambda: self.repo.get_launches(filter_format=filter_format, limit=limit)
        )

    # obtener ranking con cache
    async def get_ranking(self, period: str = "weekly", limit: int = 6) -> List[Dict[str, Any]]:
        cache_key = f"yume:cache:home:ranking:{period}:{limit}"
        return await cached_query(
            cache_key, lambda: self.repo.get_ranking(period=period, limit=limit)
        )

    # obtener obras populares con cache
    async def get_popular(self, format: Optional[str] = None, limit: int = 4) -> List[Dict[str, Any]]:
        cache_key = f"yume:cache:home:popular:{format or 'all'}:{limit}"
        return await cached_query(
            cache_key, lambda: self.repo.get_popular(format=format, limit=limit)
        )

    # obtener anuncios con cache
    async def get_announcements(self, filter_type: Optional[str] = None) -> List[Dict[str, Any]]:
        cache_key = f"yume:cache:home:announcements:{filter_type or 'all'}"
        return await cached_query(
            cache_key, lambda: self.repo.get_announcements(filter_type=filter_type)
        )

    # continuar lectura del usuario
    async def get_continue_reading(self, user_id: int) -> List[Dict[str, Any]]:
        return await self.repo.get_continue_reading(user_id=user_id)

    # obtener estado de misiones diarias
    async def get_missions(self, user_id: int) -> Dict[str, Any]:
        return await self.repo.get_missions(user_id=user_id)

    # reclamar recompensa de mision
    async def claim_mission(self, user_id: int, mission_key: str) -> Dict[str, Any]:
        return await self.repo.claim_mission(user_id=user_id, mission_key=mission_key)
