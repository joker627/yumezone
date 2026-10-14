import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from typing import List
from azure.storage.blob.aio import BlobServiceClient

from app.core.dependencies import get_current_active_user
from app.modules.users.models import CurrentUser

router = APIRouter()

ALLOWED_EXTENSIONS = {".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Obtener cadena de conexión de Azure desde .env
AZURE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
CONTAINER_NAME = "images"

def validate_file(file: UploadFile):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Formato de imagen no permitido: {ext}. Solo se admiten archivos .webp."
        )
    return ext

@router.post("/images")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    if current_user.platform_role.upper() not in ["ADMIN", "SUPERADMIN"] and not current_user.is_scan_member:
        raise HTTPException(status_code=403, detail="No tienes permisos para subir imágenes")

    if not AZURE_CONNECTION_STRING:
        raise HTTPException(status_code=500, detail="AZURE_STORAGE_CONNECTION_STRING no configurado")

    try:
        async with BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING) as blob_service_client:
            container_client = blob_service_client.get_container_client(CONTAINER_NAME)
            if not await container_client.exists():
                await container_client.create_container()

            urls = []
            for file in files:
                ext = validate_file(file)
                unique_name = f"{uuid.uuid4()}{ext}"
                try:
                    blob_client = container_client.get_blob_client(blob=unique_name)
                    content = await file.read()
                    await blob_client.upload_blob(content, overwrite=True)
                    urls.append(blob_client.url)
                finally:
                    await file.close()

            return {"urls": urls}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen a Azure: {str(e)}")
