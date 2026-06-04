import uuid
from sqlmodel import Field, SQLModel

from src.enums.SeasonFormat import SeasonFormat
from src.enums.SeasonStatus import SeasonStatus


class Season(SQLModel, table=True):
    __tablename__ = "season"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    number: int = Field(unique=True)
    status: SeasonStatus = Field(default=SeasonStatus.upcoming)
    format: SeasonFormat = Field(default=SeasonFormat.regular)
