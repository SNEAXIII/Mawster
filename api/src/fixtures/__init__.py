from sqlmodel import create_engine

from src.security.secrets import SECRET

sync_engine = create_engine(
    f"postgresql+psycopg://{SECRET.POSTGRES_USER}:{SECRET.POSTGRES_PASSWORD}@{SECRET.POSTGRES_HOST}:{SECRET.POSTGRES_PORT}/{SECRET.POSTGRES_DB}",
)
