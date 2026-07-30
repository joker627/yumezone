# 1. Librerías Estándar de Python
import os
from dataclasses import dataclass

# 2. Librerías de Terceros 
from dotenv import load_dotenv

# 3. Módulos Locales de la Aplicación 
load_dotenv()

def get_env_or_raise(key: str) -> str:

    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Falta la variable de entorno obligatoria: {key}")
    return value

@dataclass(frozen=True)
class Settings:
    api_title: str
    mysql_host: str
    mysql_port: int
    mysql_user: str
    mysql_password: str
    mysql_database: str

def get_settings() -> Settings:
    return Settings(
        api_title=get_env_or_raise("API_TITLE"),
        mysql_host=get_env_or_raise("MYSQL_HOST"),
        mysql_port=int(get_env_or_raise("MYSQL_PORT")),
        mysql_user=get_env_or_raise("MYSQL_USER"),
        mysql_password=get_env_or_raise("MYSQL_PASSWORD"),
        mysql_database=get_env_or_raise("MYSQL_DATABASE"),
    )
