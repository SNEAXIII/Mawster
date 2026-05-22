import uuid
from sqlmodel import Field, SQLModel


class Season(SQLModel, table=True):
    __tablename__ = "season"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    number: int = Field(unique=True)
    is_big_thing: bool = Field(default=False)
