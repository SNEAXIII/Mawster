from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import URL
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from src.security.secrets import SECRET

url_object: URL = URL.create(
    "postgresql+psycopg",
    username=SECRET.POSTGRES_USER,
    password=SECRET.POSTGRES_PASSWORD,
    host=SECRET.POSTGRES_HOST,
    database=SECRET.POSTGRES_DB,
    port=SECRET.POSTGRES_PORT,
)

# 25 per process (one event loop outgrows the 5 + 10 defaults) + 5 for audit = 30: two replicas
# hold 60 of PostgreSQL's 100, and a start-first deploy's third task briefly 90.
async_engine = create_async_engine(
    url=url_object,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=15,
    max_overflow=10,
)

# Its own pool: the request session still holds a connection while the audit writes, so a
# shared pool lets parallel refusals starve the whole API.
audit_engine = create_async_engine(
    url=url_object,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=2,
    max_overflow=3,
    pool_timeout=2,
)

SessionFactory = async_sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async with SessionFactory() as session:
        yield session


async def get_audit_session() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async with AsyncSession(audit_engine, expire_on_commit=False) as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
