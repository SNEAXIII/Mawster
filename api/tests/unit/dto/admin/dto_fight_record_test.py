import uuid
from unittest.mock import MagicMock

from src.dto.admin.dto_fight_record import (
    WarFightPrefightResponse,
    WarFightRecordResponse,
    WarFightSynergyResponse,
)
from src.enums.WarBoost import WarBoost
from src.models.Base import utcnow


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


def test_fight_record_response_flattens_all():
    record = MagicMock()
    record.id = uuid.uuid4()
    record.war_id = uuid.uuid4()
    record.alliance_id = uuid.uuid4()
    record.alliance.name = "Alliance X"
    record.alliance.tag = "AX"
    record.season_id = None
    record.game_account.game_pseudo = "PlayerOne"
    record.battlegroup = 1
    record.node_number = 10
    record.tier = 5
    record.champion_id = uuid.uuid4()
    record.champion = _make_champion("Spider-Man", "Science")
    record.stars = 7
    record.rank = 5
    record.ascension = 1
    record.is_saga_attacker = True
    record.defender_champion_id = uuid.uuid4()
    record.defender_champion = _make_champion("Thanos", "Cosmic")
    record.defender_stars = 6
    record.defender_rank = 3
    record.defender_ascension = 0
    record.defender_is_saga_defender = False
    record.ko_count = 2
    record.war_boost = WarBoost.INVULNERABILITY
    record.has_defense_boost = True
    record.has_power_boost = False
    record.has_specials_boost = False
    record.synergies = []
    record.prefights = []
    record.created_at = utcnow()

    result = WarFightRecordResponse.model_validate(record)
    assert result.game_account_pseudo == "PlayerOne"
    assert result.champion_name == "Spider-Man"
    assert result.defender_champion_name == "Thanos"
    assert result.tier == 5
    assert result.alliance_name == "Alliance X"
    assert result.alliance_tag == "AX"
