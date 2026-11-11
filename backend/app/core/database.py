from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Clase base declarativa para todos los modelos ORM de SQLAlchemy 2.0."""

    def to_dict(self) -> dict[str, Any]:
        return {col.name: getattr(self, col.name) for col in self.__table__.columns}


engine: Optional[AsyncEngine] = None
AsyncSessionLocal: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    global engine, AsyncSessionLocal
    if engine is None:
        settings = get_settings()
        connect_args = {}
        if settings.db_ssl:
            connect_args["ssl"] = "require"

        pool_size = max(1, min(settings.db_pool_max, 20))
        max_overflow = max(5, settings.db_pool_max - pool_size)

        engine = create_async_engine(
            settings.database_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,
            pool_recycle=1800,
            connect_args=connect_args,
        )
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global AsyncSessionLocal
    if AsyncSessionLocal is None:
        get_engine()
    assert AsyncSessionLocal is not None
    return AsyncSessionLocal


async def init_db_pool() -> None:
    try:
        eng = get_engine()
        async with eng.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print(" Pool de conexiones PostgreSQL (SQLAlchemy Async) inicializado exitosamente")
    except Exception as e:
        print(f" Error crítico inicializando Pool de PostgreSQL: {e}")
        raise RuntimeError(f"Fallo crítico al conectar con PostgreSQL: {e}") from e


async def close_db_pool() -> None:
    global engine, AsyncSessionLocal
    if engine is not None:
        await engine.dispose()
        engine = None
        AsyncSessionLocal = None
        print(" Pool de conexiones PostgreSQL cerrado de forma segura.")


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            if session.in_transaction():
                await session.commit()
        except Exception:
            if session.in_transaction():
                await session.rollback()
            raise


@asynccontextmanager
async def transaction_scope() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with session.begin():
            yield session


@asynccontextmanager
async def resolve_session(
    session: Optional[AsyncSession] = None,
) -> AsyncGenerator[AsyncSession, None]:
    if session is not None:
        yield session
    else:
        session_factory = get_session_factory()
        async with session_factory() as new_session:
            try:
                yield new_session
                if new_session.in_transaction():
                    await new_session.commit()
            except Exception:
                if new_session.in_transaction():
                    await new_session.rollback()
                raise

