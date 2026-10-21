import aiomysql
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from app.core.settings.config import get_settings

db_pool: Optional[aiomysql.Pool] = None

# inicio de pool de conexiones
async def init_db_pool():
    global db_pool
    settings = get_settings()
    try:
        db_pool = await aiomysql.create_pool(
            host=settings.db_host,
            port=settings.db_port,
            user=settings.db_user,
            password=settings.db_pass,
            db=settings.db_name,
            minsize=settings.db_pool_min,
            maxsize=settings.db_pool_max,
            autocommit=True,
        )
        print(" Pool de conexiones inicializado exitosamente")
    except Exception as e:
        print(f" Error crítico inicializando Pool de conexiones: {e}")
        raise RuntimeError(f"Fallo crítico al conectar con la base de datos: {e}") from e

# cierre de pool de conexiones
async def close_db_pool():
    if db_pool is not None:
        db_pool.close()
        await db_pool.wait_closed()
        print(" Pool de conexiones cerrado de forma segura.")

# obtencion de pool de conexiones
async def get_db_pool() -> aiomysql.Pool:
    if db_pool is None:
        raise Exception("La base de datos no está conectada.")
    return db_pool

# obtencion de conexion a la base de datos (inyección de dependencias)
async def get_db_connection() -> AsyncGenerator[aiomysql.Connection, None]:
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        try:
            yield conn
        finally:
            try:
                if not conn.get_autocommit():
                    await conn.rollback()
            except Exception:
                pass

# contexto transaccional atómico
@asynccontextmanager
async def transaction_scope() -> AsyncGenerator[aiomysql.Connection, None]:
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.begin()
        try:
            yield conn
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise

