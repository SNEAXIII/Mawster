from sqlmodel import Field

from src.models.Base import UUIDBase


class Mastery(UUIDBase, table=True):
    __tablename__ = "mastery"

    name: str = Field(max_length=64)
    max_value: int = Field(ge=1)
    order: int = Field(default=0)
