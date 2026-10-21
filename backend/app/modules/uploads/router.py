import os
import uuid
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from azure.storage.blob.aio import BlobServiceClient
from azure.storage.blob import ContentSettings

from app.core.dependencies import get_current_active_user
from app.modules.users.models import CurrentUser

router = APIRouter()

ALLOWED_EXTENSIONS = {".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_FILES_PER_REQUEST = 60
WEBP_MAGIC_RIFF = b"RIFF"
WEBP_MAGIC_WEBP = b"WEBP"

AZURE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
CONTAINER_NAME = "images"


async def validate_and_read_image(file: UploadFile) -> tuple[str, bytes]:
    filename = file.filename or "image.webp"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no permitido ({ext}). Solo se admiten archivos .webp legítimos.",
        )

    # Leer primeros 12 bytes para validar Magic Bytes de WebP
    header = await file.read(12)
    if len(header) < 12 or header[0:4] != WEBP_MAGIC_RIFF or header[8:12] != WEBP_MAGIC_WEBP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo '{filename}' no es un archivo WebP válido (firma binaria inválida).",
        )

    # Leer el resto del contenido con límite de tamaño estricto
    remaining = await file.read(MAX_FILE_SIZE - 11)
    extra_byte = await file.read(1)
    if extra_byte:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo '{filename}' excede el límite máximo de 5 MB.",
        )

    content = header + remaining
    return ext, content


@router.post("/images")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    if current_user.platform_role.upper() not in ["ADMIN", "SUPERADMIN"] and not current_user.is_scan_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para subir imágenes")

    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron archivos")

    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Máximo permitido: {MAX_FILES_PER_REQUEST} archivos por petición.",
        )

    if not AZURE_CONNECTION_STRING:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="AZURE_STORAGE_CONNECTION_STRING no configurado")

    try:
        async with BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING) as blob_service_client:
            container_client = blob_service_client.get_container_client(CONTAINER_NAME)
            if not await container_client.exists():
                await container_client.create_container()

            urls = []
            for file in files:
                try:
                    ext, content = await validate_and_read_image(file)
                    unique_name = f"{uuid.uuid4()}{ext}"
                    blob_client = container_client.get_blob_client(blob=unique_name)
                    await blob_client.upload_blob(
                        content,
                        overwrite=True,
                        content_settings=ContentSettings(
                            content_type="image/webp",
                            cache_control="public, max-age=31536000, immutable",
                        ),
                    )
                    urls.append(blob_client.url)
                finally:
                    await file.close()

            return {"urls": urls}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir imagen a Azure: {str(e)}",
        )
