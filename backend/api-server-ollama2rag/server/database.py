
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

# Database URL - Using SQLite for now
# For Postgres: postgresql+asyncpg://user:password@host/dbname
DATABASE_URL = "sqlite+aiosqlite:///./sql_app.db"

# Create Async Engine
engine = create_async_engine(
    DATABASE_URL, 
    echo=True, # Set to False in production
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Session Factory
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base declaration removed, using SQLModel


# Dependency for FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
