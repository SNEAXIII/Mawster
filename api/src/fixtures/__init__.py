from sqlmodel import create_engine

from src.utils.db import url_object

sync_engine = create_engine(url_object)
