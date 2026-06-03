import uuid
from sqlmodel import Field, SQLModel

from src.enums.SeasonFormat import SeasonFormat


class Season(SQLModel, table=True):
    __tablename__ = "season"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    number: int = Field(unique=True)
    is_active: bool = Field(default=False)
    format: SeasonFormat = Field(default=SeasonFormat.regular)
