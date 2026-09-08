from pydantic import BaseModel, Field

from src.dto.admin.dto_champion import ChampionResponse


class CatalogChampionResponse(ChampionResponse):
    """One catalog champion, as anyone may read it — signed in or not.

    Extends the champion shape every other response already uses, so a field added or
    renamed there travels here instead of drifting. Carries no player data: what the
    game says about the character, plus the saga roles of the season now running.
    """

    is_saga_attacker: bool = False
    is_saga_defender: bool = False


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
