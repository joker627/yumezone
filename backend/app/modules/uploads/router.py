import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from typing import List
from azure.storage.blob import BlobServiceClient

from app.core.dependencies import get_current_active_user
from app.modules.users.models import CurrentUser

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Obtener cadena de conexión de Azure desde .env
AZURE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
CONTAINER_NAME = "images"

def validate_file(file: UploadFile):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Extensión no permitida: {ext}")
    return ext

@router.post("/images")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    if current_user.platform_role.upper() not in ["ADMIN", "SUPERADMIN"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para subir imágenes")

    if not AZURE_CONNECTION_STRING:
        raise HTTPException(status_code=500, detail="AZURE_STORAGE_CONNECTION_STRING no configurado")

    try:
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        container_client = blob_service_client.get_container_client(CONTAINER_NAME)
        # Crear contenedor si no existe
        if not container_client.exists():
            container_client.create_container()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al conectar con Azure: {str(e)}")

    urls = []
    for file in files:
        ext = validate_file(file)
        unique_name = f"{uuid.uuid4()}{ext}"
        
        try:
            blob_client = container_client.get_blob_client(blob=unique_name)
            # Subir archivo leyendo de forma síncrona/streaming
            file.file.seek(0)
            blob_client.upload_blob(file.file, overwrite=True)
            
            # URL real del blob según la cuenta de la connection string
            urls.append(blob_client.url)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al subir imagen a Azure: {str(e)}")
        finally:
            file.file.close()
            
    return {"urls": urls}
