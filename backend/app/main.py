# imports standard
import os
from contextlib import asynccontextmanager

# imports external
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

# imports internal
from app.core.database import close_db_pool, init_db_pool
from app.core.redis import close_redis_pool, init_redis_pool
from app.modules.admin.router import router as admin_router
from app.modules.announcements.router import router as announcements_router
from app.modules.auth.router import router as auth_router
from app.modules.chapters.router import router as chapter_router
from app.modules.comments.router import router as comments_router
from app.modules.hero.router import router as hero_router
from app.modules.home.router import router as home_router
from app.modules.library.router import router as library_router
from app.modules.metrics.router import router as metrics_router
from app.modules.notifications.router import router as notifications_router
from app.modules.scans.router import router as scan_group_router
from app.modules.shop.router import router as shop_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import router as users_router
from app.modules.works.router import router as work_router

load_dotenv()

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
    title=os.environ.get('API_TITLE', 'YumeZone API'),
    version='1.0.0',
    lifespan=lifespan,
    description='API para mangas, manhwas y manhuas',
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

cors_origins = [
    origin.strip()
    for origin in os.getenv('CORS_ALLOW_ORIGINS', '').split(',')
    if origin.strip()
] or ['*']

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Registro centralizado de rutas api v1
api_router = APIRouter(prefix='/api/v1')

ROUTERS = [
    auth_router,
    work_router,
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

@app.get('/')
def read_root():
    return {'message': 'Bienvenido a YumeZone API'}