"""Unit tests for WarResponse DTO – model_validate / flatten_relations."""
import uuid
from datetime import datetime
from types import SimpleNamespace

from src.dto.dto_war import WarResponse, WarPlacementResponse, WarPrefightResponse


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


def _make_war(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "alliance_id": uuid.uuid4(),
        "opponent_name": "Enemy Alliance",
        "status": "active",
        "created_at": datetime(2025, 1, 1, 12, 0, 0),
        "created_by": _ns(game_pseudo="OwnerPlayer"),
        "bans": [],
    }
    defaults.update(overrides)
    return _ns(**defaults)


def _make_placement(**overrides):
    champ = _ns(
        name="Spider-Man",
        champion_class="Science",
        image_url="/img/spider.png",
        is_saga_attacker=False,
        is_saga_defender=False,
    )
    defaults = {
        "id": uuid.uuid4(),
        "war_id": uuid.uuid4(),
        "battlegroup": 1,
        "node_number": 10,
        "champion_id": uuid.uuid4(),
        "champion": champ,
        "stars": 7,
        "rank": 3,
        "ascension": 0,
        "placed_by": _ns(game_pseudo="OfficerPlayer"),
        "created_at": datetime(2025, 1, 1, 12, 0, 0),
        "ko_count": 0,
        "attacker_champion_user_id": None,
        "attacker_champion_user": None,
    }
    defaults.update(overrides)
    return _ns(**defaults)


# ─── WarResponse ──────────────────────────────────────────

class TestWarResponseDTO:
    def test_active_war_serializes(self):
        war = _make_war()
        dto = WarResponse.model_validate(war)

        assert dto.id == war.id
        assert dto.opponent_name == "Enemy Alliance"
        assert dto.status == "active"
        assert dto.created_by_pseudo == "OwnerPlayer"

    def test_ended_war_serializes(self):
        war = _make_war(status="ended")
        dto = WarResponse.model_validate(war)

        assert dto.status == "ended"

    def test_from_dict_passthrough(self):
        """If data is already a dict, no flattening should occur."""
        data = {
            "id": uuid.uuid4(),
            "alliance_id": uuid.uuid4(),
            "opponent_name": "Enemy",
            "status": "active",
            "created_by_pseudo": "Someone",
            "created_at": datetime(2025, 1, 1),
        }
        dto = WarResponse.model_validate(data)
        assert dto.opponent_name == "Enemy"
        assert dto.status == "active"
        assert dto.created_by_pseudo == "Someone"


# ─── WarPlacementResponse ─────────────────────────────────

class TestWarPlacementResponseDTO:
    def test_placement_serializes(self):
        p = _make_placement()
        dto = WarPlacementResponse.model_validate(p)

        assert dto.node_number == 10
        assert dto.champion_name == "Spider-Man"
        assert dto.champion_class == "Science"
        assert dto.rarity == "7r3"
        assert dto.ascension == 0
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False
        assert dto.placed_by_pseudo == "OfficerPlayer"

    def test_placement_rarity_format(self):
        p = _make_placement(stars=6, rank=4)
        dto = WarPlacementResponse.model_validate(p)
        assert dto.rarity == "6r4"

    def test_placement_with_ascension(self):
        p = _make_placement(ascension=2)
        dto = WarPlacementResponse.model_validate(p)
        assert dto.ascension == 2

    def test_placement_no_placer(self):
        p = _make_placement(placed_by=None)
        dto = WarPlacementResponse.model_validate(p)
        assert dto.placed_by_pseudo is None


def _make_prefight(**overrides):
    champ = _ns(
        name="Quake",
        champion_class="Science",
        image_url=None,
        is_saga_attacker=False,
        is_saga_defender=False,
    )
    cu = _ns(
        champion=champ,
        rarity="7r3",
        ascension=0,
    )
    defaults = {
        "id": uuid.uuid4(),
        "war_id": uuid.uuid4(),
        "battlegroup": 1,
        "game_account_id": uuid.uuid4(),
        "champion_user_id": uuid.uuid4(),
        "target_node_number": 5,
        "champion_user": cu,
        "game_account": _ns(game_pseudo="Player1"),
        "created_at": datetime(2025, 1, 1, 12, 0, 0),
    }
    defaults.update(overrides)
    return _ns(**defaults)


class TestWarPrefightResponseDTO:
    def test_prefight_serializes(self):
        obj = _make_prefight()
        dto = WarPrefightResponse.model_validate(obj)

        assert dto.champion_name == "Quake"
        assert dto.champion_class == "Science"
        assert dto.image_url is None
        assert dto.rarity == "7r3"
        assert dto.ascension == 0
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False
        assert dto.target_node_number == 5
        assert dto.game_pseudo == "Player1"

    def test_prefight_different_node(self):
        obj = _make_prefight(target_node_number=42)
        dto = WarPrefightResponse.model_validate(obj)
        assert dto.target_node_number == 42
