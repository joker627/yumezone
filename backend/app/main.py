import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import aiomysql

# Cargar .env antes de usar os.environ
load_dotenv()

# Importamos nuestro gestor de base de datos del "core"
from app.core.database import init_db_pool, close_db_pool, get_db_pool

# Verificar que la carpeta uploads exista
os.makedirs("uploads", exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # AL ARRANCAR: Conectar a la base de datos
    await init_db_pool()
    yield
    # AL APAGAR: Cerrar la conexión
    await close_db_pool()

app = FastAPI(title=os.environ["API_TITLE"], version="1.0.0", lifespan=lifespan)

# Configurar CORS cargando los orígenes permitidos desde el .env
cors_origins = os.environ["CORS_ALLOW_ORIGINS"].split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "¡Bienvenido a la API de YumeZone!"}

# Endpoint de comprobación de salud que pediste
@app.get("/health")
async def health_check(pool: aiomysql.Pool = Depends(get_db_pool)):
    try:
        # Pedimos prestada una conexión al Pool solo para verificar
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                # Ejecutamos una consulta SQL súper básica para probar
                await cur.execute("SELECT 1")
                resultado = await cur.fetchone()
                
                if resultado[0] == 1:
                    return {
                        "status": "success",
                        "message": "Base de datos conectada exitosamente"
                    }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Fallo al conectar a la base de datos: {str(e)}"
        }

# Aquí abajo registraremos los routers de los módulos más adelante.
# Ejemplo: app.include_router(users.router)
