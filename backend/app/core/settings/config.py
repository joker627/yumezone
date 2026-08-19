import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

def get_env_or_raise(key: str) -> str:
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Falta la variable de entorno obligatoria: {key}")
    return value

@dataclass()
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

def get_settings() -> Settings:
    return Settings(
        api_title=get_env_or_raise("API_TITLE"),
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
    )
