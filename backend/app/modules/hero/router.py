import aiomysql

from fastapi import APIRouter, Depends

from app.core.database import get_db_connection
from app.core.dependencies import get_optional_current_user
from app.modules.hero.repository import HeroRepository
from app.modules.hero.schemas import HeroResponse
from app.modules.hero.services import HeroService
from app.modules.users.models import CurrentUser

router = APIRouter(tags=["Hero"])


def get_hero_service(
    conn: aiomysql.Connection = Depends(get_db_connection),
) -> HeroService:
    return HeroService(HeroRepository(conn))


@router.get("/", response_model=HeroResponse)
async def get_hero(
    current_user: CurrentUser | None = Depends(get_optional_current_user),
    service: HeroService = Depends(get_hero_service),
) -> HeroResponse:
    return await service.get_hero(current_user.id if current_user else None)
