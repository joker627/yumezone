import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.core.redis import cached_query
from app.modules.home.repository import HomeRepository
from app.modules.home.schemas import (
    CarouselInfo,
    HeroActions,
    HeroBadge,
    HeroItem,
    HeroResponse,
    HeroScanGroup,
    HeroStats,
    LibraryAction,
    LatestChapter,
    NextChapter,
    ReadFirstAction,
    SubscribeAction,
)


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

        launches = await self.get_launches(limit=6)
        ranking = await self.get_ranking(period="all", limit=6)
        popular = await self.get_popular(limit=4)
        announcements = await self.get_announcements()
        continue_reading = await (self.get_continue_reading(user_id) if user_id else _empty_list())
        missions = await (self.get_missions(user_id) if user_id else _guest_missions())

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

    # Lógica del carrusel Hero integrada
    async def get_hero(self, user_id: Optional[int] = None) -> HeroResponse:
        await self.repo.rotate_hero_new_queue()
        groups = await self.repo.get_hero_groups()
        total_items = sum(len(items) for items in groups.values())
        grouped_items: Dict[str, List[HeroItem]] = {
            "top": [],
            "popular": [],
            "new": [],
        }
        current_index = 0

        for group_name, works in groups.items():
            enriched_list = await self.repo.enrich_hero_works_batch(works, user_id)
            for position, details in enumerate(enriched_list, start=1):
                current_index += 1
                grouped_items[group_name].append(
                    self._build_hero_item(
                        details,
                        group_name,
                        position,
                        current_index,
                        total_items,
                    )
                )

        return HeroResponse(
            top=grouped_items["top"],
            popular=grouped_items["popular"],
            new=grouped_items["new"],
        )

    def _build_hero_item(
        self,
        details: Dict[str, Any],
        group: str,
        position: int,
        current_index: int,
        total_items: int,
    ) -> HeroItem:
        work = details["work"]
        stats = {
            "rating_average": float(work["rating_average"]),
            "rating_count": int(work["rating_count"]),
            "rating_count_formatted": self._format_count(work["rating_count"]),
            "favorites_count": int(work["favorites_count"]),
            "total_views": int(work["total_views"]),
            "trending_score": float(work["trending_score"]),
        }
        latest = self._latest_chapter(details["latest"])
        next_chapter = self._next_chapter(details["next"])
        first = details["first"]
        library = details["library"]
        first_number = first["number"] if first else 1
        first_text = f"Empezar a leer • Cap. {self._number(first_number)}"
        first_url = (
            f"/pages/leer.html?obra={work['slug']}&capitulo={self._number(first_number)}&chapter_id={first['id']}"
            if first
            else None
        )
        count = int(library["count"])
        is_added = bool(library["is_added"])
        is_subscribed = bool(library["is_subscribed"])
        user_rating = (
            float(library["user_rating"])
            if library.get("user_rating") is not None
            else None
        )
        return HeroItem(
            id=work["id"],
            title=work["title"],
            slug=work["slug"],
            alternative_title=work["alternative_title"],
            synopsis=work["synopsis"],
            author=work["author"],
            cover_url=work["cover_url"],
            banner_url=work["banner_url"],
            hero_badge=self._badge(group, position),
            scan_group=HeroScanGroup(
                id=work["scan_group_id"],
                name=work["scan_group_name"],
                slug=work["scan_group_slug"],
                logo_url=work["scan_group_logo_url"],
            ),
            genres=details["genres"],
            stats=HeroStats(**stats),
            latest_chapter=latest,
            next_chapter=next_chapter,
            actions=HeroActions(
                read_first=ReadFirstAction(
                    text=first_text,
                    chapter_id=first["id"] if first else None,
                    url=first_url,
                ),
                library=LibraryAction(
                    text="Te gusta" if is_added else "Me gusta",
                    count=count,
                    count_formatted=self._format_count(count),
                    is_added=is_added,
                ),
                subscribe=SubscribeAction(
                    text="Recordar",
                    is_subscribed=is_subscribed,
                ),
            ),
            carousel_info=CarouselInfo(
                current_index=current_index,
                total_items=total_items,
                group=group,
                position_in_group=position,
            ),
            user_rating=user_rating,
        )

    @staticmethod
    def _badge(group: str, position: int) -> HeroBadge:
        if group == "top":
            return HeroBadge(
                text=f"#{position} TENDENCIA GLOBAL",
                color="red",
                icon="flame",
            )
        if group == "popular":
            return HeroBadge(
                text=f"#{position} MÁS LEÍDO SEMANAL",
                color="blue",
                icon="star",
            )
        return HeroBadge(text="NUEVO LANZAMIENTO", color="green", icon="sparkles")

    @staticmethod
    def _format_count(value: int) -> str:
        if value < 1000:
            return str(value)
        if value < 1_000_000:
            return f"{value / 1000:.1f}k"
        return f"{value / 1_000_000:.1f}m"

    @staticmethod
    def _number(value: Any) -> str:
        return f"{float(value):.1f}"

    @classmethod
    def _latest_chapter(cls, chapter: Optional[Dict[str, Any]]) -> LatestChapter:
        if not chapter:
            return LatestChapter()
        published_at = chapter["published_at"]
        return LatestChapter(
            id=chapter["id"],
            number=chapter["number"],
            title=chapter["title"],
            published_at=published_at,
            published_text=cls._published_text(published_at),
            scan_group_name=chapter["scan_group_name"],
        )

    @staticmethod
    def _next_chapter(chapter: Optional[Dict[str, Any]]) -> NextChapter:
        if not chapter:
            return NextChapter()
        return NextChapter(
            id=chapter["id"],
            number=chapter["number"],
            title=chapter["title"],
            status=chapter["status"],
            status_label="PRÓXIMAMENTE",
            release_text="Próximamente • En traducción",
            scan_group_name=chapter["scan_group_name"],
        )

    @staticmethod
    def _published_text(published_at: Optional[datetime]) -> Optional[str]:
        if published_at is None:
            return None
        now = datetime.now(published_at.tzinfo)
        delta = now - published_at
        if delta.total_seconds() < 3600:
            minutes = max(1, int(delta.total_seconds() // 60))
            return f"publicado hace {minutes} minutos"
        calendar_days = (now.date() - published_at.date()).days
        if calendar_days == 0:
            return "publicado hoy"
        if calendar_days == 1:
            return "publicado ayer"
        if calendar_days < 7:
            return f"publicado hace {calendar_days} días"
        return f"publicado el {published_at:%d/%m/%Y}"

