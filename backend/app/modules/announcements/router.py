from typing import Optional
import aiomysql
from fastapi import APIRouter, Depends

from app.core.database import get_db_connection
from app.modules.home.repository import HomeRepository
from app.modules.home.services import HomeService

router = APIRouter()


def get_home_service(conn: aiomysql.Connection = Depends(get_db_connection)) -> HomeService:
    repo = HomeRepository(conn)
    return HomeService(repo)


@router.get("/")
@router.get("")
async def get_announcements(
    type: Optional[str] = None,
    service: HomeService = Depends(get_home_service),
):
    """Retorna los anuncios, noticias y avisos activos del sitio."""
    items = await service.get_announcements(filter_type=type)
    return {"results": items, "count": len(items)}
