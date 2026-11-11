# imports standard
from contextlib import asynccontextmanager

# imports external
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

# imports internal
from app.core.config import get_settings
from app.core.redis import close_redis_pool, init_redis_pool
from app.core.database import close_db_pool, init_db_pool
from app.modules.admin.router import metrics_router, router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.chapters.router import router as chapter_router
from app.modules.comments.router import router as comments_router
from app.modules.home.router import announcements_router, hero_router, router as home_router
from app.modules.notifications.router import router as notifications_router
from app.modules.scans.router import router as scan_group_router
from app.modules.series.router import router as series_router
from app.modules.shop.router import router as shop_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import library_router, router as users_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # iniciar la aplicacion
    await init_db_pool()
    await init_redis_pool()
    yield
    # cerrar la aplicacion
    await close_redis_pool()
    await close_db_pool()


app = FastAPI(
    title=settings.api_title,
    version="1.0.0",
    lifespan=lifespan,
    description="API para mangas, manhwas y manhuas",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

cors_origins = settings.cors_allow_origins or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Registro centralizado de rutas api v1
api_router = APIRouter(prefix="/api/v1")

ROUTERS = [
    auth_router,
    series_router,
    chapter_router,
    scan_group_router,
    library_router,
    hero_router,
    home_router,
    metrics_router,
    admin_router,
    notifications_router,
    comments_router,
    uploads_router,
    users_router,
    shop_router,
    announcements_router,
]

for router in ROUTERS:
    api_router.include_router(router)

app.include_router(api_router)
