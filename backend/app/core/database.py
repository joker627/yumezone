import aiomysql
from app.core.settings.config import get_settings

db_pool: aiomysql.Pool = None

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
            autocommit=True
        )
        print(" Pool de conexiones inicializado exitosamente.")
    except Exception as e:
        print(f" Error inicializando Pool de conexiones: {e}")

async def close_db_pool():
    global db_pool
    if db_pool is not None:
        db_pool.close()
        await db_pool.wait_closed()
        print(" Pool de conexiones cerrado de forma segura.")

async def get_db_pool() -> aiomysql.Pool:
    if db_pool is None:
        raise Exception("La base de datos no está conectada.")
    return db_pool
