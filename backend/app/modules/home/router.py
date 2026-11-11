from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_optional_current_user
from app.core.database import get_db_session
from app.modules.home.repository import HomeRepository
from app.modules.home.schemas import ClaimMissionPayload, HeroResponse
from app.modules.home.services import HomeService
from app.modules.users.schemas import CurrentUser

router = APIRouter(prefix="/home", tags=["Inicio"])
hero_router = APIRouter(prefix="/hero", tags=["Hero"])
announcements_router = APIRouter(prefix="/announcements", tags=["Anuncios"])


def get_home_service(conn: AsyncSession = Depends(get_db_session)) -> HomeService:
    repo = HomeRepository(conn)
    return HomeService(repo)


@announcements_router.get("/")
@announcements_router.get("")
async def get_announcements(
    type: Optional[str] = None,
    service: HomeService = Depends(get_home_service),
):
    items = await service.get_announcements(filter_type=type)
    return {"results": items, "count": len(items)}


# Endpoints del carrusel Hero integrados (/api/v1/hero)
@hero_router.get("/", response_model=HeroResponse)
async def get_hero(
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    service: HomeService = Depends(get_home_service),
) -> HeroResponse:
    return await service.get_hero(current_user.id if current_user else None)



# feed consolidado del home
@router.get("/feed/")
async def get_home_feed(
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    service: HomeService = Depends(get_home_service),
):
    user_id = current_user.id if current_user else None
    return await service.get_home_feed(user_id=user_id)


@router.get("/launches/")
async def get_launches(
    format: Optional[str] = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 6,
    service: HomeService = Depends(get_home_service),
):
    items = await service.get_launches(filter_format=format, limit=limit)
    return {"results": items, "count": len(items)}


@router.get("/ranking/")
async def get_ranking(
    period: Annotated[str, Query(pattern="^(weekly|monthly|all)$")] = "weekly",
    limit: Annotated[int, Query(ge=1, le=20)] = 6,
    service: HomeService = Depends(get_home_service),
):
    items = await service.get_ranking(period=period, limit=limit)
    return {"results": items, "count": len(items), "period": period}


@router.get("/popular/")
async def get_popular(
    format: Optional[str] = None,
    limit: Annotated[int, Query(ge=1, le=12)] = 4,
    service: HomeService = Depends(get_home_service),
):
    items = await service.get_popular(format=format, limit=limit)
    return {"results": items, "count": len(items)}


@router.get("/continue/")
async def get_continue_reading(
    current_user: CurrentUser = Depends(get_optional_current_user),
    service: HomeService = Depends(get_home_service),
):
    if not current_user:
        return {"results": [], "count": 0, "auth_required": True}
    items = await service.get_continue_reading(user_id=current_user.id)
    return {"results": items, "count": len(items)}


@router.get("/mission/")
async def get_mission(
    current_user: CurrentUser = Depends(get_optional_current_user),
    service: HomeService = Depends(get_home_service),
):
    if not current_user:
        return {
            "auth_required": True,
            "description": "Inicia sesión para ver tus misiones diarias.",
            "missions": [],
        }
    return await service.get_missions(user_id=current_user.id)


@router.post("/mission/claim/")
async def claim_mission(
    payload: ClaimMissionPayload,
    current_user: CurrentUser = Depends(get_current_user),
    service: HomeService = Depends(get_home_service),
):
    try:
        return await service.claim_mission(user_id=current_user.id, mission_key=payload.mission_key)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
