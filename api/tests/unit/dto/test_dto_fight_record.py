import uuid
from unittest.mock import MagicMock
from src.dto.dto_fight_record import (
    WarFightRecordResponse,
    WarFightSynergyResponse,
    WarFightPrefightResponse,
)


def _make_champion(name="Wolverine", champion_class="Mutant", image_url=None):
    c = MagicMock()
    c.name = name
    c.champion_class = champion_class
    c.image_url = image_url
    return c


def test_synergy_response_flattens_champion():
    syn = MagicMock()
    syn.champion_id = uuid.uuid4()
    syn.champion = _make_champion("Wolverine", "Mutant")
    syn.stars = 6
    syn.ascension = 1

    result = WarFightSynergyResponse.model_validate(syn)
    assert result.champion_name == "Wolverine"
    assert result.champion_class == "Mutant"
    assert result.stars == 6


def test_prefight_response_flattens_champion():
    pf = MagicMock()
    pf.champion_id = uuid.uuid4()
    pf.champion = _make_champion("Magneto", "Mutant")
    pf.stars = 7
    pf.ascension = 0

    result = WarFightPrefightResponse.model_validate(pf)
    assert result.champion_name == "Magneto"
    assert result.stars == 7


def test_fight_record_response_flattens_all():
    record = MagicMock()
    record.id = uuid.uuid4()
    record.war_id = uuid.uuid4()
    record.alliance_id = uuid.uuid4()
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
    record.synergies = []
    record.prefights = []
    from datetime import datetime
    record.created_at = datetime.now()

    result = WarFightRecordResponse.model_validate(record)
    assert result.game_account_pseudo == "PlayerOne"
    assert result.champion_name == "Spider-Man"
    assert result.defender_champion_name == "Thanos"
    assert result.tier == 5
