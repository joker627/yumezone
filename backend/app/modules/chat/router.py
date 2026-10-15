import time
from typing import Annotated

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.chat.repository import ChatRepository
from app.modules.users.models import CurrentUser

router = APIRouter()


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


# Almacén de presencia en tiempo real en memoria: user_id -> { "last_seen": timestamp, "user": {...} }
_online_presence: dict[int, dict] = {}
ONLINE_TTL_SECONDS = 40 


@router.post("/heartbeat")
async def register_heartbeat(
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Registra la presencia activa del usuario mientras está en la página."""
    _online_presence[current_user.id] = {
        "last_seen": time.time(),
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "avatar_url": current_user.avatar_url,
            "anillo_url": current_user.anillo_url or current_user.avatar_frame_url,
            "avatar_frame_url": current_user.anillo_url or current_user.avatar_frame_url,
            "platform_role": current_user.platform_role,
            "xp": current_user.xp,
        }
    }
    return {"status": "ok"}


@router.delete("/heartbeat")
async def unregister_heartbeat(
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Elimina al usuario inmediatamente al cerrar la pestaña o salir de la página."""
    _online_presence.pop(current_user.id, None)
    return {"status": "ok"}


@router.get("/online")
async def get_online_users():
    """Retorna usuarios verdaderamente en línea en tiempo real más los activos recientes."""
    now = time.time()
    # Purgar usuarios que se hayan desconectado (sin heartbeat en > 40s)
    expired = [uid for uid, data in _online_presence.items() if now - data["last_seen"] > ONLINE_TTL_SECONDS]
    for uid in expired:
        _online_presence.pop(uid, None)

    realtime_users = [data["user"] for data in _online_presence.values()]
    return {
        "online_count": len(realtime_users),
        "active_users": realtime_users
    }


@router.get("/messages")
async def list_messages(
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    repo = ChatRepository(conn)
    messages = await repo.list_messages(limit=limit)
    return {"data": messages}


@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def create_message(
    payload: ChatMessageCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="El mensaje no puede estar vacío")

    repo = ChatRepository(conn)
    message_id = await repo.create_message(current_user.id, content)
    await conn.commit()
    return {"id": message_id, "content": content}


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    repo = ChatRepository(conn)
    row = await repo.get_message(message_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if row["user_id"] != current_user.id and current_user.platform_role.upper() not in {"ADMIN", "SUPERADMIN"}:
        raise HTTPException(status_code=403, detail="No puedes eliminar este mensaje")

    await repo.delete_message(message_id)
    await conn.commit()
    return None
