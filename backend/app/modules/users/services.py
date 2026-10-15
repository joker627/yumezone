from typing import Optional, List
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import UserProfileResponse, UserUpdate, UserSearchItem, LevelInfo

LEVEL_TITLES = [
    "Iniciado del Cultivo",
    "Lector Novato",
    "Cazador Errante",
    "Adepto de las Sombras",
    "Guerrero Celestial",
    "Maestro de Secta",
    "Monarca Espiritual",
    "Nigromante Supremo",
    "Monarca de las Sombras",
    "Soberano Cósmico"
]

def calculate_level_info(xp: int = 0) -> LevelInfo:
    safe_xp = max(0, int(xp or 0))
    xp_per_level = 1000
    level = (safe_xp // xp_per_level) + 1
    current_level_xp = safe_xp % xp_per_level
    pct = min(100, int((current_level_xp / xp_per_level) * 100))
    remaining = xp_per_level - current_level_xp
    title_idx = min(len(LEVEL_TITLES) - 1, max(0, (level - 1) // 5))
    next_idx = min(len(LEVEL_TITLES) - 1, title_idx + 1)
    return LevelInfo(
        level=level,
        current_level_xp=current_level_xp,
        remaining_xp=remaining,
        percentage=pct,
        current_title=LEVEL_TITLES[title_idx],
        next_title=LEVEL_TITLES[next_idx]
    )

class UserService:
    def __init__(self):
        self.repo = UserRepository()

    async def get_profile(self, identifier: str, requester_id: Optional[int] = None) -> Optional[UserProfileResponse]:
        user_data = await self.repo.get_user_by_identifier(identifier)
        if not user_data:
            return None

        is_owner = (requester_id == user_data["id"])
        
        # Si es privado y no es el dueño, se oculta cierta información (bio, stats opcionales)
        is_hidden = False
        stats = user_data.get("stats") or {}
        favorite_works = user_data.get("favorite_works") or []
        recent_activity = user_data.get("recent_activity") or []
        genres_breakdown = user_data.get("genres_breakdown") or []

        if user_data["is_private"] and not is_owner:
            is_hidden = True
            user_data["bio"] = "Este perfil es privado."
            stats = {}
            favorite_works = []
            recent_activity = []
            genres_breakdown = []
            user_data["streak_days"] = 0
            user_data["coins"] = 0

        # Cálculo dinámico de nivel, logros y medallas basado en actividad real
        xp = user_data.get("xp") or 0
        lvl_info = calculate_level_info(xp)

        streak = user_data.get("streak_days") or 0
        chapters = stats.get("total_chapters_read") or 0
        following = stats.get("following_count") or 0
        comments = stats.get("total_comments") or 0
        role = (user_data.get("platform_role") or "USER").upper()
        has_scan = bool(user_data.get("scan_group"))

        # Obtener badges dinámicamente desde la base de datos SQL
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
            recent_activity=recent_activity,
            genres_breakdown=genres_breakdown,
            badges=badges
        )


    async def update_profile(self, user_id: int, data: UserUpdate) -> bool:
        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return True
        return await self.repo.update_user(user_id, update_dict)

    async def search_users(self, query: str) -> List[UserSearchItem]:
        # Si el query empieza con @, lo limpiamos para la búsqueda
        clean_query = query.strip().lstrip('@')
        if not clean_query:
            return []
            
        results = await self.repo.search_users(clean_query)
        return [UserSearchItem(**r) for r in results]
