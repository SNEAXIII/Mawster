from pydantic import BaseModel, ConfigDict, Field

from src.dto.admin.dto_champion import ChampionResponse
from src.enums.SeasonStatus import SeasonStatus


class CatalogSeasonResponse(BaseModel):
    """A regular season the public catalog can be read for."""

    model_config = ConfigDict(from_attributes=True)

    number: int
    status: SeasonStatus


class CatalogChampionResponse(ChampionResponse):
    """One catalog champion, as anyone may read it — signed in or not.

    Extends the champion shape every other response already uses, so a field added or
    renamed there travels here instead of drifting. Carries no player data: what the
    game says about the character, plus the saga roles of the season now running —
    those two flags now live on the parent, which fills them for a chosen season.
    """


class CatalogResponse(BaseModel):
    """The whole champion catalog, in one unpaginated read.

    Unpaginated on purpose: the tier list pool shows every champion at once and filters
    client-side, so paging it would only mean fetching every page anyway.
    """

    season_number: int | None = Field(
        default=None,
        description="Season the saga roles come from; null when no season is running.",
        examples=[42],
    )
    champions: list[CatalogChampionResponse]
