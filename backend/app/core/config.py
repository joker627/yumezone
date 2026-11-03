import os
from dataclasses import dataclass, field
from functools import lru_cache
from dotenv import load_dotenv

# Carga el archivo .env
load_dotenv(".env")


# Verifica variables de entorno
def get_env_or_raise(key: str) -> str:
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Falta la variable de entorno obligatoria: {key}")
    return value


# Config class
@dataclass
class Settings:
    api_title: str
    db_host: str
    db_port: int
    db_user: str
    db_pass: str
    db_name: str
    db_pool_min: int
    db_pool_max: int
    jwt_secret: str
    jwt_algo: str
    jwt_exp: int
    redis_url: str | None
    cookie_secure: bool
    cors_allow_origins: list[str] = field(default_factory=list)


# Caché de settings y carga de config desde .env
@lru_cache()
def get_settings() -> Settings:
    cors_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
        if origin.strip()
    ]

    return Settings(
        api_title=os.getenv("API_TITLE", "API"),
        db_host=get_env_or_raise("DB_HOST"),
        db_port=int(get_env_or_raise("DB_PORT")),
        db_user=get_env_or_raise("DB_USER"),
        db_pass=get_env_or_raise("DB_PASS"),
        db_name=get_env_or_raise("DB_NAME"),
        db_pool_min=int(get_env_or_raise("DB_POOL_MIN")),
        db_pool_max=int(get_env_or_raise("DB_POOL_MAX")),
        jwt_secret=get_env_or_raise("JWT_SECRET"),
        jwt_algo=get_env_or_raise("JWT_ALGO"),
        jwt_exp=int(get_env_or_raise("JWT_EXP")),
        redis_url=os.getenv("REDIS_URL"),
        cookie_secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        cors_allow_origins=cors_origins,
    )


# Instancia global opcional
settings = get_settings()