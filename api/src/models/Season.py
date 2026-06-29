from sqlmodel import Field

from src.enums.SeasonFormat import SeasonFormat
from src.enums.SeasonStatus import SeasonStatus
from src.models.Base import UUIDBase


class Season(UUIDBase, table=True):
    __tablename__ = "season"

    number: int = Field(unique=True)
    status: SeasonStatus = Field(default=SeasonStatus.upcoming)
    format: SeasonFormat = Field(default=SeasonFormat.regular)
