from datetime import datetime
from typing import Any, Dict, List, Optional

from app.modules.hero.repository import HeroRepository
from app.modules.hero.schemas import (
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


class HeroService:
    def __init__(self, repository: HeroRepository):
        self.repository = repository

    async def get_hero(self, user_id: Optional[int] = None) -> HeroResponse:
        await self.repository.rotate_new_queue()
        groups = await self.repository.get_groups()
        total_items = sum(len(items) for items in groups.values())
        grouped_items: Dict[str, List[HeroItem]] = {
            "top": [],
            "popular": [],
            "new": [],
        }
        current_index = 0

        for group_name, works in groups.items():
            for position, work in enumerate(works, start=1):
                current_index += 1
                details = await self.repository.enrich_work(work, user_id)
                grouped_items[group_name].append(
                    self._build_item(
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

    def _build_item(
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
            "followers_count": int(work["followers_count"]),
            "followers_count_formatted": self._format_count(work["followers_count"]),
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
        first_url = f"/works/{work['slug']}/{first['id']}" if first else None
        count = int(library["count"])
        is_added = bool(library["is_added"])
        is_subscribed = bool(library["is_subscribed"])
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
                    text="En Biblioteca" if is_added else "Añadir a Biblioteca",
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
        number = float(value)
        return str(int(number)) if number.is_integer() else str(number)

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
