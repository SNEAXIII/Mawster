from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.enums.SeasonFormat import SeasonFormat
from src.enums.SeasonStatus import SeasonStatus
from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.ChampionSagaRole import ChampionSagaRole


class Season(UUIDBase, table=True):
    __tablename__ = "season"

    number: int = Field(unique=True)
    status: SeasonStatus = Field(default=SeasonStatus.upcoming)
    format: SeasonFormat = Field(default=SeasonFormat.regular)

    # Relations
    saga_roles: list["ChampionSagaRole"] = Relationship(
        back_populates="season", cascade_delete=True
    )
