from pydantic import BaseModel, Field


class PublicStatsResponse(BaseModel):
    active_alliances: int = Field(examples=[12])
    participating_players: int = Field(examples=[340])
    knowledge_base_fights: int = Field(examples=[5820])
    wars_recorded: int = Field(examples=[42])
