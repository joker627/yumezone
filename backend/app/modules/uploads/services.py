import asyncio
import os
from pathlib import Path
from typing import List
import uuid

from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient
from fastapi import HTTPException, UploadFile, status

ALLOWED_EXTENSIONS = {".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_FILES_PER_REQUEST = 60
WEBP_MAGIC_RIFF = b"RIFF"
WEBP_MAGIC_WEBP = b"WEBP"


class UploadService:
    def __init__(self, connection_string: str | None = None):
        self.connection_string = connection_string or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
        self.container_name = os.environ.get("AZURE_STORAGE_CONTAINER")

    # validar formato y cabeceras binarias webp
    async def validate_and_read_image(self, file: UploadFile) -> tuple[str, bytes]:
        filename = file.filename or "image.webp"
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato no permitido ({ext}). Solo se admiten archivos .webp.",
            )

        header = await file.read(12)
        if len(header) < 12 or header[0:4] != WEBP_MAGIC_RIFF or header[8:12] != WEBP_MAGIC_WEBP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo '{filename}' no es un archivo WebP válido.",
            )

        remaining = await file.read(MAX_FILE_SIZE - 11)
        extra_byte = await file.read(1)
        if extra_byte:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo '{filename}' excede el límite máximo de 5 MB.",
            )

        return ext, header + remaining

    # procesar y subir imagenes a azure blob storage
    async def upload_images(self, files: List[UploadFile]) -> List[str]:
        if not files:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron archivos")

        if len(files) > MAX_FILES_PER_REQUEST:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Máximo permitido: {MAX_FILES_PER_REQUEST} archivos por petición.",
            )

        if not self.connection_string:
            # Fallback local para desarrollo si Azure no está configurado
            repo_root = Path(__file__).resolve().parents[4]
            upload_dir = repo_root / "frontend" / "assets" / "comic" / "uploads"
            upload_dir.mkdir(parents=True, exist_ok=True)

            async def save_local_single(file: UploadFile) -> str:
                try:
                    ext, content = await self.validate_and_read_image(file)
                    unique_name = f"{uuid.uuid4()}{ext}"
                    dest = upload_dir / unique_name
                    with open(dest, "wb") as f:
                        f.write(content)
                    return f"/assets/comic/uploads/{unique_name}"
                finally:
                    await file.close()

            urls = await asyncio.gather(*(save_local_single(f) for f in files))
            return list(urls)

        if not self.container_name:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falta configurar AZURE_STORAGE_CONTAINER.",
            )

        try:
            async with BlobServiceClient.from_connection_string(self.connection_string) as blob_service_client:
                container_client = blob_service_client.get_container_client(self.container_name)
                if not await container_client.exists():
                    await container_client.create_container()

                async def upload_single(file: UploadFile) -> str:
                    try:
                        ext, content = await self.validate_and_read_image(file)
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
                        return blob_client.url
                    finally:
                        await file.close()

                urls = await asyncio.gather(*(upload_single(f) for f in files))
                return list(urls)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al subir imagen a Azure: {str(e)}",
            )
