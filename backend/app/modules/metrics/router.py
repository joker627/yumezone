import aiomysql
from fastapi import APIRouter, Depends, Request, status

from app.core.database import get_db_connection
from app.core.dependencies import get_current_admin_user, get_optional_current_user
from app.modules.metrics.repository import MetricsRepository
from app.modules.metrics.schemas import ViewLogCreate
from app.modules.metrics.services import MetricsService
from app.modules.users.models import CurrentUser
from app.utils import get_client_ip

router = APIRouter(prefix="/metrics", tags=["Métricas"])


def get_metrics_service(conn: aiomysql.Connection = Depends(get_db_connection)) -> MetricsService:
    repository = MetricsRepository(conn)
    return MetricsService(repository)


@router.post("/views", status_code=status.HTTP_204_NO_CONTENT)
async def log_view(
    data: ViewLogCreate,
    request: Request,
    current_user: CurrentUser = Depends(get_optional_current_user),
    service: MetricsService = Depends(get_metrics_service),
):
    client_ip = get_client_ip(request)
    await service.log_view(data, client_ip, current_user)
    return None


@router.post("/compute", status_code=status.HTTP_200_OK)
async def compute_statistics(
    _: CurrentUser = Depends(get_current_admin_user),
    service: MetricsService = Depends(get_metrics_service),
):
    await service.compute_statistics()
    return {"status": "ok"}
