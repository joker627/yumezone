import hashlib
from typing import Optional
from fastapi import HTTPException

from app.modules.metrics.repository import MetricsRepository
from app.modules.metrics.schemas import ViewLogCreate
from app.modules.users.models import CurrentUser


class MetricsService:
    def __init__(self, repository: MetricsRepository):
        self.repo = repository

    async def log_view(
        self,
        data: ViewLogCreate,
        client_ip: Optional[str],
        current_user: Optional[CurrentUser],
    ) -> None:
        if not await self.repo.has_valid_target(data.work_id, data.chapter_id):
            raise HTTPException(status_code=404, detail="Obra o capítulo no encontrado")

        hashed_ip = None
        if client_ip:
            hashed_ip = hashlib.sha256(client_ip.encode()).hexdigest()

        user_id = current_user.id if current_user else None
        await self.repo.log_view(data.work_id, data.chapter_id, user_id, hashed_ip)

    async def compute_statistics(self) -> None:
        await self.repo.compute_statistics()
