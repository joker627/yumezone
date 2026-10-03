from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class HeroBadge(BaseModel):
    text: str
    color: str
    icon: Optional[str] = None


class HeroScanGroup(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    logo_url: Optional[str] = None


class HeroGenre(BaseModel):
    id: int
    name: str


class HeroStats(BaseModel):
    rating_average: float
    rating_count: int
    rating_count_formatted: str
    followers_count: int
    followers_count_formatted: str
    favorites_count: int
    total_views: int
    trending_score: float


class LatestChapter(BaseModel):
    id: Optional[int] = None
    number: Optional[float] = None
    title: Optional[str] = None
    published_at: Optional[datetime] = None
    published_text: Optional[str] = None
    scan_group_name: Optional[str] = None


class NextChapter(BaseModel):
    id: Optional[int] = None
    number: Optional[float] = None
    title: Optional[str] = None
    status: Optional[str] = None
    status_label: Optional[str] = None
    release_text: Optional[str] = None
    scan_group_name: Optional[str] = None


class ReadFirstAction(BaseModel):
    text: str
    chapter_id: Optional[int] = None
    url: Optional[str] = None


class LibraryAction(BaseModel):
    text: str
    count: int
    count_formatted: str
    is_added: bool


class SubscribeAction(BaseModel):
    text: str
    is_subscribed: bool


class HeroActions(BaseModel):
    read_first: ReadFirstAction
    library: LibraryAction
    subscribe: SubscribeAction


class CarouselInfo(BaseModel):
    current_index: int
    total_items: int
    group: str
    position_in_group: int


class HeroItem(BaseModel):
    id: int
    title: str
    slug: str
    alternative_title: Optional[str] = None
    synopsis: Optional[str] = None
    author: Optional[str] = None
    cover_url: Optional[str] = None
    banner_url: Optional[str] = None
    hero_badge: HeroBadge
    scan_group: HeroScanGroup
    genres: List[HeroGenre]
    stats: HeroStats
    latest_chapter: LatestChapter
    next_chapter: NextChapter
    actions: HeroActions
    carousel_info: CarouselInfo


class HeroResponse(BaseModel):
    top: List[HeroItem]
    popular: List[HeroItem]
    new: List[HeroItem]
