import uuid
from sqlmodel import Field, SQLModel


class Mastery(SQLModel, table=True):
    __tablename__ = "mastery"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=64)
    max_value: int = Field(ge=1)
    order: int = Field(default=0)
