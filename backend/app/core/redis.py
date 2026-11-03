import json
from typing import Optional

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

