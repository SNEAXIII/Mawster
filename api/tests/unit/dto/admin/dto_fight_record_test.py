import uuid
from unittest.mock import MagicMock

from src.dto.admin.dto_fight_record import (
    WarFightPrefightResponse,
    WarFightSynergyResponse,
)


def _make_champion(name="Wolverine", champion_class="Mutant", image_url=None):
    c = MagicMock()
    c.name = name
    c.champion_class = champion_class
    c.image_url = image_url
    return c


def _make_link(name, champion_class, stars, ascension):
    link = MagicMock()
    link.champion_user.champion_id = uuid.uuid4()
    link.champion_user.champion = _make_champion(name, champion_class)
    link.champion_user.stars = stars
    link.champion_user.ascension = ascension
    return link


def test_synergy_response_flattens_champion():
    result = WarFightSynergyResponse.model_validate(_make_link("Wolverine", "Mutant", 6, 1))
    assert result.champion_name == "Wolverine"
    assert result.champion_class == "Mutant"
    assert result.stars == 6


def test_prefight_response_flattens_champion():
    result = WarFightPrefightResponse.model_validate(_make_link("Magneto", "Mutant", 7, 0))
    assert result.champion_name == "Magneto"
    assert result.stars == 7
