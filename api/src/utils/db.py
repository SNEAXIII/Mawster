from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import URL
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, create_engine
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
# far more requests in flight than that. 25 per process, two replicas, against a
# server that allows 151.
async_engine = AsyncEngine(
    create_engine(
        url=url_object,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=15,
        max_overflow=10,
    )
)

SessionFactory = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async with SessionFactory() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
