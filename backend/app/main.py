# imports standard
import os
from contextlib import asynccontextmanager

# imports external
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html

# imports internal
from app.core.database import close_db_pool, init_db_pool
from app.modules.auth.router import router as auth_router
from app.modules.works.router import router as work_router
from app.modules.chapters.router import router as chapter_router
from app.modules.scans.router import router as scan_group_router
from app.modules.library.router import router as library_router
from app.modules.hero.router import router as hero_router
from app.modules.home.router import router as home_router
from app.modules.metrics.router import router as metrics_router
from app.modules.admin.router import router as admin_router
from app.modules.notifications.router import router as notifications_router
from app.modules.comments.router import router as comments_router
from app.modules.chat.router import router as chat_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import router as users_router
from app.modules.shop.router import router as shop_router

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # iniciar la aplicacion
    await init_db_pool()
    yield
    # cerrar la aplicacion
    await close_db_pool()

app = FastAPI(
    title=os.environ.get("API_TITLE"),
    version="1.0.0",
    lifespan=lifespan,
    description="API para mangas, manhwas y manhuas",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

# strip() previene que un espacio extra en .env rompa el preflight de CORS
cors_origins_env = os.environ.get("CORS_ALLOW_ORIGINS", "")
cors_origins = [
    origin.strip()
    for origin in cors_origins_env.split(",")
    if origin.strip()
]
if "*" in cors_origins:
    raise ValueError("CORS_ALLOW_ORIGINS no puede contener '*' cuando se usan credenciales")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir enrutadores organizados por etiquetas
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Autenticación"])
app.include_router(work_router, prefix="/api/v1/works", tags=["Obras"])
app.include_router(chapter_router, prefix="/api/v1/chapters", tags=["Capítulos"])
app.include_router(scan_group_router, prefix="/api/v1/scan-groups", tags=["Scanlators"])
app.include_router(library_router, prefix="/api/v1/library", tags=["Biblioteca"])
app.include_router(hero_router, prefix="/api/v1/hero", tags=["Hero"])
app.include_router(home_router, prefix="/api/v1/home", tags=["Inicio"])
app.include_router(metrics_router, prefix="/api/v1/metrics", tags=["Métricas"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["Administración"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notificaciones"])
app.include_router(comments_router, prefix="/api/v1/comments", tags=["Comentarios"])
app.include_router(chat_router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(uploads_router, prefix="/api/v1/uploads", tags=["Uploads"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Usuarios"])
app.include_router(shop_router, prefix="/api/v1/shop", tags=["Tienda"])

@app.get("/")
def read_root():
    return {"message": "Bienvenido a YumeZone API"}