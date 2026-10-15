from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import Annotated, Optional

import aiomysql

from app.core.database import get_db_connection
from app.core.dependencies import get_current_user, get_optional_current_user
from app.modules.home.repository import HomeRepository
from app.modules.users.models import CurrentUser

router = APIRouter()


def _repo(conn: aiomysql.Connection = Depends(get_db_connection)) -> HomeRepository:
    return HomeRepository(conn)


@router.get("/launches/")
async def get_launches(
    format: Optional[str] = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 6,
    repo: HomeRepository = Depends(_repo),
):
    items = await repo.get_launches(filter_format=format, limit=limit)
    return {"results": items, "count": len(items)}


@router.get("/ranking/")
async def get_ranking(
    period: Annotated[str, Query(pattern="^(weekly|monthly|all)$")] = "weekly",
    limit: Annotated[int, Query(ge=1, le=20)] = 6,
    repo: HomeRepository = Depends(_repo),
):
    items = await repo.get_ranking(period=period, limit=limit)
    return {"results": items, "count": len(items), "period": period}


@router.get("/popular/")
async def get_popular(
    format: Optional[str] = None,
    limit: Annotated[int, Query(ge=1, le=12)] = 4,
    repo: HomeRepository = Depends(_repo),
):
    items = await repo.get_popular(format=format, limit=limit)
    return {"results": items, "count": len(items)}



@router.get("/announcements/")
async def get_announcements(
    type: Optional[str] = None, repo: HomeRepository = Depends(_repo)
):
    items = await repo.get_announcements(filter_type=type)
    return {"results": items, "count": len(items)}


@router.get("/continue/")
async def get_continue_reading(
    current_user: CurrentUser = Depends(get_optional_current_user),
    repo: HomeRepository = Depends(_repo),
):
    if not current_user:
        return {"results": [], "count": 0, "auth_required": True}
    items = await repo.get_continue_reading(user_id=current_user.id)
    return {"results": items, "count": len(items)}


@router.get("/chat/recent/")
async def get_recent_chat(
    limit: Annotated[int, Query(ge=1, le=30)] = 10,
    repo: HomeRepository = Depends(_repo),
):
    items = await repo.get_recent_chat(limit=limit)
    return {"results": items, "count": len(items)}


class ClaimMissionPayload(BaseModel):
    mission_key: str


@router.get("/mission/")
async def get_mission(
    current_user: CurrentUser = Depends(get_optional_current_user),
    repo: HomeRepository = Depends(_repo),
):
    if not current_user:
        return {
            "auth_required": True,
            "description": "Inicia sesión para ver tus misiones diarias.",
            "missions": [],
        }
    return await repo.get_missions(user_id=current_user.id)


@router.post("/mission/claim/")
async def claim_mission(
    payload: ClaimMissionPayload,
    current_user: CurrentUser = Depends(get_current_user),
    repo: HomeRepository = Depends(_repo),
):
    try:
        return await repo.claim_mission(user_id=current_user.id, mission_key=payload.mission_key)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
