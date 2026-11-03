import time
from typing import Dict, Tuple
from fastapi import HTTPException, status

from app.core.redis import get_redis_client

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
