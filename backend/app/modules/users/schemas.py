import re
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date
from pydantic import BaseModel, Field, field_validator
from app.modules.series.schemas import WorkResponse

LibraryStatus = Literal["READING", "COMPLETED", "ON_HOLD", "PLAN_TO_READ", "DROPPED"]


class LibraryReadingProgress(BaseModel):
    chapter_id: int
    chapter_number: Optional[float] = None
    chapter_text: str
    last_page_read: int = 1
    total_pages: int = 1
    read_chapters: int = 0
    total_chapters: int = 0
    remaining_chapters: int = 0
    page_text: str = ""
    progress_pct: int = 0
    read_at: Optional[datetime] = None
    reader_url: Optional[str] = None


class LibraryItem(WorkResponse):
    library_status: Optional[LibraryStatus] = None
    rating: Optional[float] = None
    notify_new_chapters: bool = True
    added_at: Optional[datetime] = None
    reading_progress: Optional[LibraryReadingProgress] = None


class LibraryWorkStatus(BaseModel):
    in_library: bool
    status: Optional[LibraryStatus] = None
    item: Optional[LibraryItem] = None


class LibraryAdd(BaseModel):
    status: LibraryStatus = "READING"


class LibraryStatusUpdate(BaseModel):
    status: LibraryStatus


class NotificationPreferenceUpdate(BaseModel):
    notify_new_chapters: bool


class NotificationPreferenceResponse(BaseModel):
    work_id: int
    notify_new_chapters: bool


class ReadingHistoryCreate(BaseModel):
    work_id: int = Field(gt=0)
    chapter_id: int = Field(gt=0)
    last_page_read: Optional[int] = Field(default=1, ge=1)
    completed: Optional[bool] = False


class WorkRatingUpdate(BaseModel):
    rating: float = Field(ge=0.5, le=10.0, description="Calificación entre 0.5 y 10.0")


class WorkRatingResponse(BaseModel):
    work_id: int
    user_rating: Optional[float] = None
    rating_average: Optional[float] = None
    rating_count: Optional[int] = None


class MarkAllReadRequest(BaseModel):
    read: bool = True



class User(BaseModel):
    id: Optional[int] = None
    user_code: str
    username: str
    email: str
    password: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = "CO"
    bio: Optional[str] = None
    is_private: bool = False
    platform_role: str = "USER"
    status: str = "ACTIVE"
    xp: int = 0
    coins: int = 0
    clan_tokens: int = 0
    streak_days: int = 0
    last_streak_date: Optional[date] = None
    streak_event: Optional[str] = None
    streak_message: Optional[str] = None
    previous_streak: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    level: int = 1
    level_title: str = "Iniciado del Cultivo"
    level_progress_pct: int = 0
    remaining_xp: int = 1000
    level_info: Optional[object] = None


class CurrentUser(BaseModel):
    id: int
    user_code: str
    username: str
    email: str
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = "CO"
    bio: Optional[str] = None
    is_private: bool = False
    platform_role: str = "USER"
    is_scan_member: bool = False
    status: str = "ACTIVE"
    xp: int = 0
    coins: int = 0
    clan_tokens: int = 0
    streak_days: int = 0
    last_streak_date: Optional[date] = None
    streak_event: Optional[str] = None
    streak_message: Optional[str] = None
    previous_streak: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    level: int = 1
    level_title: str = "Iniciado del Cultivo"
    level_progress_pct: int = 0
    remaining_xp: int = 1000
    level_info: Optional[object] = None


class UserProfileStats(BaseModel):
    total_chapters_read: int = 0
    completed_works: int = 0
    favorites_count: int = 0
    pending_works: int = 0
    total_comments: int = 0


class LevelInfo(BaseModel):
    level: int = 1
    current_level_xp: int = 0
    remaining_xp: int = 1000
    percentage: int = 0
    current_title: str = "Iniciado del Cultivo"
    next_title: str = "Lector Novato"


class UserProfileResponse(BaseModel):
    id: int
    user_code: str
    username: str
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = "CO"
    bio: Optional[str] = None
    is_private: bool
    platform_role: str
    coins: int
    clan_tokens: int = 0
    xp: int
    streak_days: int
    last_streak_date: Optional[date] = None
    created_at: datetime
    is_owner: bool = False
    is_hidden: bool = False
    scan_group: Optional[dict] = None
    stats: Optional[UserProfileStats] = None
    level_info: Optional[LevelInfo] = None
    favorite_works: List[Dict[str, Any]] = []
    inventory_items: List[Dict[str, Any]] = []
    badges: List[Dict[str, Any]] = []


class UserUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    anillo_url: Optional[str] = None
    avatar_frame_url: Optional[str] = None
    active_title: Optional[str] = None
    country: Optional[str] = None
    is_private: Optional[bool] = None

    @field_validator("avatar_url", "banner_url", "anillo_url", "avatar_frame_url")
    @classmethod
    def validate_url_fields(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if not v:
            return None
        if any(c in v for c in ['"', "'", '<', '>', '\n', '\r', ' ']):
            raise ValueError("La URL contiene caracteres no permitidos")
        if not re.match(r"^(https?://|/)", v, re.IGNORECASE):
            raise ValueError("La URL debe iniciar con http://, https:// o /")
        return v

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().upper()
        if not re.match(r"^[A-Z]{2}$", v):
            raise ValueError("El código de país debe ser un código ISO de 2 letras (ej. CO, MX, AR)")
        return v


class UserSearchItem(BaseModel):
    id: int
    user_code: str
    username: str
    avatar_url: Optional[str] = None
    xp: int
    platform_role: str


class UserCoinTransactionResponse(BaseModel):
    id: int
    user_id: int
    amount: int
    balance_after: int
    type: str
    description: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: datetime


class WalletExchangeRequest(BaseModel):
    direction: str  # "COINS_TO_TOKENS" | "TOKENS_TO_COINS"
    amount: int     # Cantidad de Cristales a obtener (si COINS_TO_TOKENS) o de Cristales a cambiar (si TOKENS_TO_COINS)

