from typing import Optional, List
import aiomysql
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
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
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

        streak = user_data.get("streak_days") or 0
        chapters = stats.get("total_chapters_read") or 0
        following = stats.get("favorites_count") or 0
        comments = stats.get("total_comments") or 0
        role = (user_data.get("platform_role") or "USER").upper()
        has_scan = bool(user_data.get("scan_group"))

        db_badges = await self.repo.get_all_badges()
        badges = []
        for b in db_badges:
            cond_type = b.get("condition_type")
            cond_val = b.get("condition_value", 1)
            unlocked = False
            progress_str = "Bloqueado"

            if cond_type == "chapters":
                unlocked = chapters >= cond_val
                progress_str = f"{min(chapters, cond_val)}/{cond_val} caps"
            elif cond_type == "streak":
                unlocked = streak >= cond_val
                progress_str = f"{min(streak, cond_val)}/{cond_val} días"
            elif cond_type == "following":
                unlocked = following >= cond_val
                progress_str = f"{min(following, cond_val)}/{cond_val} obras"
            elif cond_type == "comments":
                unlocked = comments >= cond_val
                progress_str = f"{min(comments, cond_val)}/{cond_val} comentarios"
            elif cond_type == "staff_scan":
                unlocked = (role in ("ADMIN", "SUPERADMIN")) or has_scan
                progress_str = "Verificado Oficial" if unlocked else "Requiere Staff o Scan"

            badges.append({
                "id": b["id"],
                "name": b["name"],
                "tier": b["tier"],
                "icon": b["icon"],
                "description": b["description"],
                "unlocked": unlocked,
                "progress": progress_str
            })

        return UserProfileResponse(
            id=user_data["id"],
            user_code=user_data["user_code"],
            username=user_data["username"],
            avatar_url=user_data["avatar_url"],
            banner_url=user_data.get("banner_url"),
            anillo_url=user_data.get("anillo_url") or user_data.get("avatar_frame_url"),
            avatar_frame_url=user_data.get("anillo_url") or user_data.get("avatar_frame_url"),
            active_title=user_data.get("active_title"),
            country=user_data.get("country") or "CO",
            is_owner=is_owner,
            bio=user_data["bio"],
            is_private=bool(user_data["is_private"]),
            platform_role=user_data["platform_role"],
            coins=user_data["coins"],
            xp=user_data["xp"],
            streak_days=user_data["streak_days"],
            created_at=user_data["created_at"],
            is_hidden=is_hidden,
            scan_group=user_data.get("scan_group"),
            stats=stats,
            level_info=lvl_info,
            favorite_works=favorite_works,
            inventory_items=inventory_items,
            badges=badges
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
