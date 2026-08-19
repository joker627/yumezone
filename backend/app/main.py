# imports standard
import os
from contextlib import asynccontextmanager
# imports external
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# imports internal
from app.core.database import close_db_pool, init_db_pool
from app.modules.auth.router import router as auth_router
from app.modules.works.router import router as work_router
from app.modules.chapters.router import router as chapter_router
from app.modules.scans.router import router as scan_group_router

load_dotenv()

os.makedirs("uploads", exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # iniciar la aplicacion
    await init_db_pool()
    yield
    # cerrar la aplicacion
    await close_db_pool()

app = FastAPI(title=os.environ["API_TITLE"], version="1.0.0", lifespan=lifespan)
cors_origins = os.environ["CORS_ALLOW_ORIGINS"].split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir enrutadores
app.include_router(auth_router, prefix="/api/v1/auth")
app.include_router(work_router, prefix="/api/v1/works")
app.include_router(chapter_router, prefix="/api/v1/chapters")
app.include_router(scan_group_router, prefix="/api/v1/scan-groups")

@app.get("/")
def read_root():
    return {"message": "Bienvenido a YumeZone API"}
