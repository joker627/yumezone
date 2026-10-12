from fastapi import APIRouter, Depends, HTTPException, Request, status
import aiomysql

from app.core.database import get_db_connection
from app.core.dependencies import get_current_admin_user, get_optional_current_user
from app.modules.users.models import CurrentUser

from .schemas import ViewLogCreate
from .repository import MetricsRepository

router = APIRouter()

def get_repo(conn: aiomysql.Connection = Depends(get_db_connection)):
    return MetricsRepository(conn)

@router.post("/views", status_code=status.HTTP_204_NO_CONTENT)
async def log_view(
    data: ViewLogCreate,
    request: Request,
    current_user: CurrentUser = Depends(get_optional_current_user),
    repo: MetricsRepository = Depends(get_repo)
):
    import hashlib
    if not await repo.has_valid_target(data.work_id, data.chapter_id):
        raise HTTPException(status_code=404, detail="Obra o capítulo no encontrado")
    
    ip = request.client.host if request.client else None
    if ip:
        ip = hashlib.sha256(ip.encode()).hexdigest()
        
    user_id = current_user.id if current_user else None
    await repo.log_view(data.work_id, data.chapter_id, user_id, ip)
    return None

@router.post("/compute", status_code=status.HTTP_200_OK)
async def compute_statistics(
    _: CurrentUser = Depends(get_current_admin_user),
    repo: MetricsRepository = Depends(get_repo),
):
    await repo.compute_statistics()
    return {"status": "ok"}
