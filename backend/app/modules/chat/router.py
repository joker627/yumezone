import json
import re
import time
from typing import Annotated, Optional

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user
from app.modules.chat.repository import ChatRepository
from app.modules.notifications.repository import NotificationRepository
from app.modules.users.models import CurrentUser

router = APIRouter()


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    channel: Optional[str] = Field(default="general", max_length=50)


# Almacén de presencia en tiempo real en memoria: user_id -> { "last_seen": timestamp, "user": {...} }
_online_presence: dict[int, dict] = {}
ONLINE_TTL_SECONDS = 40  # Si no hay heartbeat en 40 segundos, se considera desconectado


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
    channel: Annotated[str, Query(max_length=50)] = "general",
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    repo = ChatRepository(conn)
    messages = await repo.list_messages(channel=channel, limit=limit)
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

    channel = (payload.channel or "general").strip().lower()
    is_staff = current_user.platform_role.upper() in {"ADMIN", "SUPERADMIN"}

    repo = ChatRepository(conn)
    notif_repo = NotificationRepository(conn)

    # Verificar si es líder, mod o admin de algún grupo Scan
    is_scan_leader = False
    if not is_staff:
        is_scan_leader = await repo.is_scan_leader(current_user.id)

    # Validación estricta de permisos por canal
    if channel == "staff" and not is_staff:
        raise HTTPException(status_code=403, detail="Solo el Staff puede enviar mensajes en #staff")
    if channel in {"anuncios", "scans"} and not (is_staff or is_scan_leader):
        raise HTTPException(status_code=403, detail="Solo el Staff y dueños/moderadores de Scan pueden publicar en #scans")

    # 1. Guardar mensaje
    message_id = await repo.create_message(current_user.id, content, channel)

    # 2. Detección y notificación en vivo de menciones: @staff o @usuario
    has_staff_mention = bool(re.search(r"@(?:staff|admin|mod|soporte)\b", content, re.IGNORECASE))
    if has_staff_mention:
        staff_user_ids = await repo.get_staff_user_ids(exclude_user_id=current_user.id)
        for staff_id in staff_user_ids:
            notif_payload = {
                "title": f"Mención en Chat #{channel}",
                "message": f"@{current_user.username} mencionó al Staff: \"{content[:140]}\"",
                "url": "/#section-chat",
                "channel": channel,
                "sender": current_user.username,
            }
            await notif_repo.create_notification(staff_id, "chat_staff_mention", notif_payload)

    # Menciones directas a usuarios específicos: @nombre
    user_mentions = set(re.findall(r"@([a-zA-Z0-9_-]{3,30})", content))
    user_mentions.discard("staff")
    user_mentions.discard("admin")
    user_mentions.discard("mod")
    user_mentions.discard("soporte")

    for mentioned_name in user_mentions:
        if mentioned_name.lower() == current_user.username.lower():
            continue
        m_user = await repo.get_user_by_username(mentioned_name)
        if m_user:
            notif_payload = {
                "title": f"Mención de @{current_user.username}",
                "message": f"Te mencionó en #{channel}: \"{content[:140]}\"",
                "url": "/#section-chat",
                "channel": channel,
                "sender": current_user.username,
            }
            await notif_repo.create_notification(m_user["id"], "chat_user_mention", notif_payload)

    await conn.commit()
    return {"id": message_id, "content": content, "channel": channel}


@router.patch("/messages/{message_id}/pin")
async def toggle_pin_message(
    message_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    conn: aiomysql.Connection = Depends(get_db_connection),
):
    if current_user.platform_role.upper() not in {"ADMIN", "SUPERADMIN"}:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden fijar mensajes en el chat")

    repo = ChatRepository(conn)
    row = await repo.get_message(message_id)
    if not row:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")

    new_pinned = not bool(row.get("is_pinned"))
    await repo.toggle_pin(message_id, new_pinned)
    await conn.commit()
    return {"id": message_id, "is_pinned": new_pinned}


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
