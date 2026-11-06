from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import URL
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker
from sqlmodel import create_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from src.security.secrets import SECRET

url_object: URL = URL.create(
    "mysql+asyncmy",
    username=SECRET.MARIADB_USER,
    password=SECRET.MARIADB_PASSWORD,
    host=SECRET.MARIADB_HOST,
    database=SECRET.MARIADB_DATABASE,
    port=SECRET.MARIADB_PORT,
)

# The defaults (5 + 10) size a pool for a thread per request; one event loop holds
# far more requests in flight than that. 25 per process, plus 5 for the audit engine
# below: 30, so 60 across two replicas, against a server that allows 151.
async_engine = AsyncEngine(
    create_engine(
        url=url_object,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=15,
        max_overflow=10,
    )
)

# Its own pool: the request session still holds a connection while the audit writes, so a
# shared pool lets parallel refusals starve the whole API.
audit_engine = AsyncEngine(
    create_engine(
        url=url_object,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=2,
        max_overflow=3,
        pool_timeout=2,
    )
)

SessionFactory = async_sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)
AuditSessionFactory = async_sessionmaker(
    bind=audit_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async with SessionFactory() as session:
        yield session


async def get_audit_session() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async with AuditSessionFactory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
