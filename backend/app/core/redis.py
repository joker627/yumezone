import json
import logging
from typing import Optional, Any
import redis.asyncio as aioredis
from app.core.settings.config import get_settings

logger = logging.getLogger("yumezone.redis")

_redis_client: Optional[aioredis.Redis] = None
_redis_available: bool = False


async def init_redis_pool():
    global _redis_client, _redis_available
    settings = get_settings()
    try:
        client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1.5,
        )
        await client.ping()
        _redis_client = client
        _redis_available = True
        print(" Conexión con Redis inicializada exitosamente.")
    except Exception as e:
        print(f" Aviso: Redis no disponible en {settings.redis_url} ({e}). Operando con fallback en memoria.")
        _redis_client = None
        _redis_available = False


async def close_redis_pool():
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        print(" Conexión con Redis cerrada.")


def get_redis_client() -> Optional[aioredis.Redis]:
    return _redis_client if _redis_available else None


def is_redis_available() -> bool:
    return _redis_available
