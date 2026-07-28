import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from src.enums.SeasonFormat import SeasonFormat
from src.enums.SeasonStatus import SeasonStatus
from src.services.alliance.war.WarFormatConfig import for_format


class SeasonCreateRequest(BaseModel):
    number: int = Field(..., ge=1, le=9999)
    format: SeasonFormat = SeasonFormat.regular


class SeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    status: SeasonStatus
    format: SeasonFormat

    @computed_field
    @property
    def max_defenders_per_player(self) -> int:
        return for_format(self.format).max_defenders_per_player

    @computed_field
    @property
    def max_attackers_per_member(self) -> int:
        return for_format(self.format).max_attackers_per_member

    @computed_field
    @property
    def node_count(self) -> int:
        return for_format(self.format).node_count
