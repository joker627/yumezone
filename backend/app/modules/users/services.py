from fastapi import HTTPException
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import (
    UserProfileResponse,
    UserUpdate,
    UserSearchItem,
    LevelInfo,
    UserCoinTransactionResponse,
)

def calculate_level_info(xp: int = 0, ranks: Optional[List[dict]] = None) -> LevelInfo:
    safe_xp = max(0, int(xp or 0))
    xp_per_level = 1000
    level = (safe_xp // xp_per_level) + 1
    current_level_xp = safe_xp % xp_per_level
    pct = min(100, int((current_level_xp / xp_per_level) * 100))
    remaining = xp_per_level - current_level_xp

    current_title = "Iniciado del Cultivo"
    next_title = "Lector Novato"

    if ranks:
        for i, r in enumerate(ranks):
            min_l = int(r.get("min_level", 1))
            max_l = int(r.get("max_level", 9999))
            if min_l <= level <= max_l:
                current_title = r.get("title", current_title)
                if i + 1 < len(ranks):
                    next_title = ranks[i + 1].get("title", current_title)
                else:
                    next_title = current_title
                break
    else:
        # Fallback dinámico genérico en base al nivel
        if level >= 46:
            current_title = "Soberano Cósmico"
            next_title = "Soberano Cósmico"
        elif level >= 41:
            current_title = "Monarca de las Sombras"
            next_title = "Soberano Cósmico"
        elif level >= 26:
            current_title = "Maestro de Secta"
            next_title = "Monarca Espiritual"
        elif level >= 11:
            current_title = "Cazador Errante"
            next_title = "Adepto de las Sombras"
        elif level >= 6:
            current_title = "Lector Novato"
            next_title = "Cazador Errante"

    return LevelInfo(
        level=level,
        current_level_xp=current_level_xp,
        remaining_xp=remaining,
        percentage=pct,
        current_title=current_title,
        next_title=next_title
    )


class UserService:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.repo = UserRepository(conn)

    async def get_profile(self, identifier: str, requester_id: Optional[int] = None) -> Optional[UserProfileResponse]:
        user_data = await self.repo.get_user_by_identifier(identifier)
        if not user_data:
            return None

        is_owner = (requester_id == user_data["id"])

        is_hidden = False
        stats = user_data.get("stats") or {}
        favorite_works = user_data.get("favorite_works") or []
        inventory_items = user_data.get("inventory_items") or []

        if user_data["is_private"] and not is_owner:
            is_hidden = True
            user_data["bio"] = "Este perfil es privado."
            stats = {}
            favorite_works = []
            inventory_items = []
            user_data["streak_days"] = 0
            user_data["coins"] = 0

        xp = user_data.get("xp") or 0
        db_ranks = await self.repo.get_cultivation_ranks()
        lvl_info = calculate_level_info(xp, ranks=db_ranks)

        return UserProfileResponse(
            id=user_data["id"],
            user_code=user_data["user_code"],
            username=user_data["username"],
            avatar_url=user_data["avatar_url"],
            banner_url=user_data.get("banner_url"),
            anillo_url=user_data.get("avatar_frame_url") or user_data.get("anillo_url"),
            avatar_frame_url=user_data.get("avatar_frame_url") or user_data.get("anillo_url"),
            active_title=user_data.get("active_title"),
            country=user_data.get("country") or "CO",
            is_owner=is_owner,
            bio=user_data["bio"],
            is_private=bool(user_data["is_private"]),
            platform_role=user_data["platform_role"],
            coins=user_data["coins"],
            clan_tokens=int(user_data.get("clan_tokens") or 0),
            xp=user_data["xp"],
            streak_days=user_data["streak_days"],
            created_at=user_data["created_at"],
            is_hidden=is_hidden,
            scan_group=user_data.get("scan_group"),
            stats=stats,
            level_info=lvl_info,
            favorite_works=favorite_works,
            inventory_items=inventory_items,
            badges=[]
        )

    async def update_profile(self, user_id: int, data: UserUpdate) -> bool:
        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return True
        return await self.repo.update_user(user_id, update_dict)

    async def search_users(self, query: str) -> List[UserSearchItem]:
        clean_query = query.strip().lstrip('@')
        if not clean_query:
            return []

        results = await self.repo.search_users(clean_query)
        return [UserSearchItem(**r) for r in results]

    async def get_coin_transactions(self, user_id: int, limit: int = 50, offset: int = 0) -> List[UserCoinTransactionResponse]:
        results = await self.repo.list_coin_transactions(user_id, limit, offset)
        return [UserCoinTransactionResponse(**r) for r in results]

    async def exchange_currency(self, user_id: int, direction: str, amount: int) -> dict:
        return await self.repo.exchange_currency(user_id, direction, amount)



    async def list_for_user(self, user_id: int):
        return await self.repo.list_for_user(user_id)

    async def get_for_user(self, user_id: int, work_id: int):
        return await self.repo.get_for_user(user_id, work_id)

    async def add_work(self, user_id: int, work_id: int, status: str):
        if not await self.repo.work_exists(work_id):
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        await self.repo.add_work(user_id, work_id, status)
        item = await self.repo.get_for_user(user_id, work_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        return item

    async def update_status(self, user_id: int, work_id: int, status: str) -> None:
        if not await self.repo.update_status(user_id, work_id, status):
            raise HTTPException(
                status_code=404,
                detail="La obra no pertenece a tu biblioteca",
            )

    async def remove_work(self, user_id: int, work_id: int) -> None:
        if not await self.repo.remove_work(user_id, work_id):
            raise HTTPException(
                status_code=404,
                detail="La obra no pertenece a tu biblioteca",
            )

    async def get_notification_preference(self, user_id: int, work_id: int) -> bool:
        preference = await self.repo.get_notification_preference(user_id, work_id)
        if preference is None:
            raise HTTPException(
                status_code=404,
                detail="La obra no está en tu biblioteca",
            )
        return preference

    async def update_notification_preference(
        self, user_id: int, work_id: int, notify_new_chapters: bool
    ) -> bool:
        updated = await self.repo.update_notification_preference(
            user_id, work_id, notify_new_chapters
        )
        if not updated:
            if notify_new_chapters:
                await self.repo.add_work(user_id, work_id, "READING")
                await self.repo.update_notification_preference(user_id, work_id, True)
                return True
            raise HTTPException(
                status_code=404,
                detail="La obra no está en tu biblioteca",
            )
        return notify_new_chapters

    async def save_reading_history(
        self, user_id: int, work_id: int, chapter_id: int, page: int = 1, completed: bool = False
    ) -> None:
        await self.repo.save_reading_history(
            user_id, work_id, chapter_id, page, completed=completed
        )

    async def set_work_rating(self, user_id: int, work_id: int, rating: float):
        if rating < 0.5 or rating > 10.0:
            raise HTTPException(status_code=422, detail="La calificación debe estar entre 0.5 y 10.0")
        if not await self.repo.work_exists(work_id):
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        return await self.repo.set_work_rating(user_id, work_id, rating)

    async def get_user_work_rating(self, user_id: int, work_id: int):
        return await self.repo.get_user_work_rating(user_id, work_id)

    async def get_user_read_chapters(self, user_id: int, work_id: int) -> List[int]:
        return await self.repo.get_user_read_chapters(user_id, work_id)

    async def toggle_chapter_read(self, user_id: int, chapter_id: int) -> dict:
        try:
            return await self.repo.toggle_chapter_read(user_id, chapter_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    async def mark_all_read(self, user_id: int, work_id: int, read: bool = True) -> dict:
        affected = await self.repo.mark_all_chapters_read(user_id, work_id, read)
        return {"work_id": work_id, "read": read, "affected": affected}

LibraryService = UserService
