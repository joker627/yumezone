import time
from typing import Any, Dict, List, Optional
from app.modules.chat.repository import ChatRepository
from app.modules.users.models import CurrentUser

ONLINE_TTL_SECONDS = 45

# Almacén de presencia en tiempo real en memoria: user_id -> { "last_seen": timestamp, "user": {...} }
_online_presence: Dict[int, Dict[str, Any]] = {}


class ChatService:
    def __init__(self, repository: Optional[ChatRepository] = None):
        self.repo = repository

    async def list_messages(self, limit: int = 40, current_user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        if not self.repo:
            return []
        return await self.repo.list_messages(limit=limit, current_user_id=current_user_id)

    async def create_message(self, user_id: int, content: str) -> int:
        if not self.repo:
            raise RuntimeError("ChatRepository no configurado.")
        return await self.repo.create_message(user_id, content)

    async def toggle_reaction(self, message_id: int, user_id: int, reaction: str) -> Dict[str, Any]:
        if not self.repo:
            raise RuntimeError("ChatRepository no configurado.")
        return await self.repo.toggle_reaction(message_id, user_id, reaction)

    @staticmethod
    def register_heartbeat(current_user: CurrentUser) -> None:
        """Registra o renueva la presencia en línea de un usuario activo."""
        _online_presence[current_user.id] = {
            "last_seen": time.time(),
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "avatar_url": current_user.avatar_url,
                "anillo_url": current_user.anillo_url or current_user.avatar_frame_url,
                "platform_role": current_user.platform_role,
                "xp": current_user.xp,
            },
        }

    @staticmethod
    def unregister_heartbeat(user_id: int) -> None:
        """Elimina la presencia inmediata cuando el usuario cierra sesión o la pestaña."""
        _online_presence.pop(user_id, None)

    @staticmethod
    def get_online_stats() -> Dict[str, Any]:
        """Purga usuarios inactivos y devuelve los usuarios en línea en tiempo real."""
        now = time.time()
        expired = [
            uid for uid, data in _online_presence.items()
            if now - data["last_seen"] > ONLINE_TTL_SECONDS
        ]
        for uid in expired:
            _online_presence.pop(uid, None)

        realtime_users: List[Dict[str, Any]] = [data["user"] for data in _online_presence.values()]
        return {
            "online_count": len(realtime_users),
            "active_users": realtime_users,
        }
