from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlmodel import create_engine, Session
from sqlalchemy import URL
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from src.security.secrets import SECRET

url_object: URL = URL.create(
    "mysql+aiomysql",
    username=SECRET.MARIADB_USER,
    password=SECRET.MARIADB_PASSWORD,
    host=SECRET.MARIADB_HOST,
    database=SECRET.MARIADB_DATABASE,
    port=SECRET.MARIADB_PORT,
)

async_engine = AsyncEngine(
    create_engine(
        url=url_object,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    Session = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
