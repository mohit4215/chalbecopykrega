import os
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.db_models import Base

logger = logging.getLogger("plagiarism.database")

# Database URL configuration
# Supports PostgreSQL with asyncpg driver, with resilient local SQLite fallback
RAW_DB_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./plagiarism_auth.db")

# Automatically adapt postgresql:// to asyncpg driver
if RAW_DB_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = RAW_DB_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif RAW_DB_URL.startswith("postgres://"):
    ASYNC_DATABASE_URL = RAW_DB_URL.replace("postgres://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DATABASE_URL = RAW_DB_URL

# Engine configuration
engine_kwargs = {"echo": False, "future": True}
if "sqlite" in ASYNC_DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

async_engine = create_async_engine(ASYNC_DATABASE_URL, **engine_kwargs)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

async def init_db():
    """Provisions tables in PostgreSQL/SQLite on application startup."""
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"Database schema initialized successfully on {ASYNC_DATABASE_URL.split('@')[-1]}.")
    except Exception as e:
        logger.error(f"Failed to initialize database tables: {e}")

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an isolated async database transaction session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
