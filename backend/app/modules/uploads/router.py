from typing import List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.dependencies import get_current_active_user
from app.modules.uploads.services import UploadService
from app.modules.users.schemas import CurrentUser

router = APIRouter(prefix="/uploads", tags=["Uploads"])


def get_upload_service() -> UploadService:
    return UploadService()


# subir imagenes en formato webp a almacenamiento cloud
@router.post("/images")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: CurrentUser = Depends(get_current_active_user),
    service: UploadService = Depends(get_upload_service),
):
    if current_user.platform_role.upper() not in ["ADMIN", "SUPERADMIN"] and not current_user.is_scan_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para subir imágenes",
        )

    urls = await service.upload_images(files)
    return {"urls": urls}
