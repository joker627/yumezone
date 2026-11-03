from typing import Annotated, Optional
import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_db_connection
from app.core.dependencies import get_current_active_user, get_optional_current_user
from app.core.rate_limit import enforce_rate_limit
from app.modules.chat.repository import ChatRepository
from app.modules.chat.schemas import ChatMessageCreate, ChatReactionToggle, OnlineStatsResponse
from app.modules.chat.services import ChatService
from app.modules.users.models import CurrentUser

router = APIRouter(prefix="/chat", tags=["Chat"])


def get_chat_service(conn: aiomysql.Connection = Depends(get_db_connection)) -> ChatService:
    return ChatService(ChatRepository(conn))


@router.get("/messages")
async def list_messages(
    limit: Annotated[int, Query(ge=1, le=100)] = 40,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    service: ChatService = Depends(get_chat_service),
):
    user_id = current_user.id if current_user else None
    messages = await service.list_messages(limit=limit, current_user_id=user_id)
    return {"data": messages}


@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def create_message(
    payload: ChatMessageCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ChatService = Depends(get_chat_service),
):
    await enforce_rate_limit(f"chat:{current_user.id}", max_requests=1, window_seconds=2)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="El mensaje no puede estar vacío")

    message_id = await service.create_message(current_user.id, content)
    return {"id": message_id, "content": content}


@router.post("/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: int,
    payload: ChatReactionToggle,
    current_user: CurrentUser = Depends(get_current_active_user),
    service: ChatService = Depends(get_chat_service),
):
    try:
        return await service.toggle_reaction(message_id, current_user.id, payload.reaction.strip())
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/heartbeat")
async def register_heartbeat(
    current_user: CurrentUser = Depends(get_current_active_user),
):
    ChatService.register_heartbeat(current_user)
    return {"status": "ok"}


@router.delete("/heartbeat")
async def unregister_heartbeat(
    current_user: CurrentUser = Depends(get_current_active_user),
):
    ChatService.unregister_heartbeat(current_user.id)
    return {"status": "ok"}


@router.get("/online", response_model=OnlineStatsResponse)
async def get_online_users():
    return ChatService.get_online_stats()
