from fastapi import APIRouter, Depends, Query
from typing import Annotated, Optional

import aiomysql

from app.core.database import get_db_connection
from app.core.dependencies import get_optional_current_user
from app.modules.home.repository import HomeRepository
from app.modules.users.models import CurrentUser

router = APIRouter(tags=["Home"])


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
    limit: Annotated[int, Query(ge=1, le=12)] = 4,
    repo: HomeRepository = Depends(_repo),
):
    items = await repo.get_popular(limit=limit)
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
    items = await repo.get_recent_chat()
    return {"results": items[:limit], "count": len(items)}


@router.get("/mission/")
async def get_mission(
    current_user: CurrentUser = Depends(get_optional_current_user),
    repo: HomeRepository = Depends(_repo),
):
    if not current_user:
        return {
            "auth_required": True,
            "description": "Inicia sesión para ver tu misión diaria.",
        }
    return await repo.get_mission(user_id=current_user.id)
