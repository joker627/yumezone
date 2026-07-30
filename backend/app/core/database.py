import os
import aiomysql
from dotenv import load_dotenv

# Cargar las variables del archivo .env
load_dotenv()

# Variable global que mantendrá el estanque (pool) de conexiones vivo
db_pool: aiomysql.Pool = None

async def init_db_pool():
    """Función para conectarse a MySQL al arrancar el servidor."""
    global db_pool
    try:
        db_pool = await aiomysql.create_pool(
            host=os.environ["MYSQL_HOST"],
            port=int(os.environ["MYSQL_PORT"]),
            user=os.environ["MYSQL_USER"],
            password=os.environ["MYSQL_PASSWORD"],
            db=os.environ["MYSQL_DATABASE"],
            minsize=int(os.environ["MYSQL_MIN_POOL_SIZE"]),
            maxsize=int(os.environ["MYSQL_MAX_POOL_SIZE"]),
            autocommit=True
        )
        print("✅ Pool de base de datos MySQL conectado exitosamente.")
    except Exception as e:
        print(f"❌ Error conectando a MySQL: {e}")

async def close_db_pool():
    """Función para cerrar la conexión a MySQL al apagar el servidor."""
    global db_pool
    if db_pool is not None:
        db_pool.close()
        await db_pool.wait_closed()
        print("❌ Pool de base de datos MySQL cerrado de forma segura.")

async def get_db_pool() -> aiomysql.Pool:
    """Función que usaremos como 'Inyección de Dependencia' en los módulos."""
    if db_pool is None:
        raise Exception("La base de datos no está conectada.")
    return db_pool