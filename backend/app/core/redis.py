import json
import time
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, status
import redis.asyncio as aioredis

from app.core.config import get_settings

_redis_client: Optional[aioredis.Redis] = None


# inicializar conexion con pool de redis
async def init_redis_pool():
    global _redis_client
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
        print(" Conexión con Redis inicializada exitosamente.")
    except Exception as e:
        print(f" Aviso: Redis no disponible en {settings.redis_url} ({e}). Se opera sin caché.")
        _redis_client = None


# cerrar conexion de redis de forma segura
async def close_redis_pool():
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        print(" Conexión con Redis cerrada.")


# obtener cliente activo de redis
def get_redis_client() -> Optional[aioredis.Redis]:
    return _redis_client


# consulta con cache redis y ejecucion de fallback seguro
async def cached_query(key: str, query_func, ttl: int = 60):
    client = get_redis_client()
    if client:
        try:
            cached = await client.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    res = query_func()
    data = await res if hasattr(res, "__await__") else res

    if client and data is not None:
        try:
            await client.set(key, json.dumps(data, default=str), ex=ttl)
        except Exception:
            pass

    return data


# rate limiting (redis con fallback en memoria)
_MEMORY_LIMITS: Dict[str, Tuple[int, float]] = {}
_MEMORY_MAX_KEYS = 1000


async def enforce_rate_limit(key: str, max_requests: int, window_seconds: int) -> None:
    redis = get_redis_client()
    if redis:
        try:
            full_key = f"yume:ratelimit:{key}"
            current = await redis.incr(full_key)
            if current == 1:
                await redis.expire(full_key, window_seconds)
            if current > max_requests:
                ttl = await redis.ttl(full_key)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Demasiadas peticiones. Intenta de nuevo en {max(ttl, 1)} segundos.",
                )
            return
        except HTTPException:
            raise
        except Exception:
            pass

    now = time.time()
    if len(_MEMORY_LIMITS) > _MEMORY_MAX_KEYS:
        expired_keys = [k for k, (_, exp) in _MEMORY_LIMITS.items() if now > exp]
        for k in expired_keys:
            _MEMORY_LIMITS.pop(k, None)

    count, reset_at = _MEMORY_LIMITS.get(key, (0, now + window_seconds))
    if now > reset_at:
        count = 0
        reset_at = now + window_seconds

    count += 1
    _MEMORY_LIMITS[key] = (count, reset_at)
    if count > max_requests:
        remaining = int(reset_at - now)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiadas peticiones. Intenta de nuevo en {max(remaining, 1)} segundos.",
        )

