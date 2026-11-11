import os
from dataclasses import dataclass, field
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv()


def get_env_or_raise(key: str) -> str:
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Falta la variable de entorno obligatoria: {key}")
    return value


@dataclass
class Settings:
    api_title: str
    database_url: str
    db_pool_min: int
    db_pool_max: int
    db_ssl: bool
    jwt_secret: str
    jwt_algo: str
    jwt_exp: int
    redis_url: str | None
    cookie_secure: bool
    cors_allow_origins: list[str] = field(default_factory=list)


@lru_cache()
def get_settings() -> Settings:
    cors_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
        if origin.strip()
    ]

    raw_url = get_env_or_raise("DATABASE_URL").strip()
    if raw_url.startswith("postgres://"):
        database_url = raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif raw_url.startswith("postgresql://"):
        database_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        database_url = raw_url

    db_pool_min = int(os.getenv("DB_POOL_MIN", "1"))
    db_pool_max = int(os.getenv("DB_POOL_MAX", "20"))
    db_ssl = os.getenv("DB_SSL", "false").lower() in ("true", "1", "require")

    return Settings(
        api_title=os.getenv("API_TITLE", "YumeZone API"),
        database_url=database_url,
        db_pool_min=db_pool_min,
        db_pool_max=db_pool_max,
        db_ssl=db_ssl,
        jwt_secret=get_env_or_raise("JWT_SECRET"),
        jwt_algo=os.getenv("JWT_ALGO", "HS256"),
        jwt_exp=int(os.getenv("JWT_EXP", "10080")),
        redis_url=os.getenv("REDIS_URL"),
        cookie_secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        cors_allow_origins=cors_origins,
    )


settings = get_settings()
