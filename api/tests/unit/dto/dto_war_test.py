"""Unit tests for WarResponse DTO – model_validate / flatten_relations."""
import uuid
from datetime import datetime
from types import SimpleNamespace

from src.dto.dto_war import (
    WarResponse,
    WarPlacementResponse,
    WarPrefightResponse,
    WarSynergyResponse,
)


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


def _make_champion(**overrides):
    defaults = {
        "name": "Spider-Man",
        "champion_class": "Science",
        "image_url": "/img/spider.png",
        "is_saga_attacker": False,
        "is_saga_defender": False,
    }
    defaults.update(overrides)
    return _ns(**defaults)


def _make_war(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "alliance_id": uuid.uuid4(),
        "opponent_name": "Enemy Alliance",
        "status": "active",
        "created_at": datetime(2025, 1, 1, 12, 0, 0),
        "created_by": _ns(game_pseudo="OwnerPlayer"),
        "bans": [],
        "season_id": None,
        "season": None,
    }
    defaults.update(overrides)
    return _ns(**defaults)


def _make_placement(champion=None, attacker=None, **overrides):
    champ = champion or _make_champion()
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
        "attacker_champion_user_id": attacker.id if attacker else None,
        "attacker_champion_user": attacker,
    }
    defaults.update(overrides)
    return _ns(**defaults)


def _make_attacker(**overrides):
    champ = _make_champion(
        name="Hercules",
        champion_class="Cosmic",
        image_url="/img/herc.png",
        is_saga_attacker=True,
        is_saga_defender=False,
    )
    defaults = {
        "id": uuid.uuid4(),
        "game_account_id": uuid.uuid4(),
        "game_account": _ns(game_pseudo="AttackerPlayer"),
        "champion": champ,
        "stars": 7,
        "rank": 3,
        "ascension": 1,
        "is_preferred_attacker": True,
    }
    defaults.update(overrides)
    obj = _ns(**defaults)
    obj.rarity = f"{obj.stars}r{obj.rank}"
    return obj


# ─── WarResponse ──────────────────────────────────────────

class TestWarResponseDTO:
    def test_active_war_serializes(self):
        war = _make_war()
        dto = WarResponse.model_validate(war)

        assert dto.id == war.id
        assert dto.opponent_name == "Enemy Alliance"
        assert dto.status == "active"
        assert dto.created_by_pseudo == "OwnerPlayer"
        assert dto.banned_champions == []

    def test_ended_war_serializes(self):
        war = _make_war(status="ended")
        dto = WarResponse.model_validate(war)

        assert dto.status == "ended"

    def test_war_with_banned_champions(self):
        ban1 = _ns(champion=_ns(
            id=uuid.uuid4(), name="Doom", champion_class="Mystic",
            image_url="/img/doom.png", is_7_star=True, is_ascendable=True,
            has_prefight=False, is_saga_attacker=True, is_saga_defender=False,
            alias=None,
        ))
        ban2 = _ns(champion=_ns(
            id=uuid.uuid4(), name="Quake", champion_class="Science",
            image_url=None, is_7_star=False, is_ascendable=False,
            has_prefight=True, is_saga_attacker=False, is_saga_defender=True,
            alias="shaker",
        ))
        war = _make_war(bans=[ban1, ban2])
        dto = WarResponse.model_validate(war)

        assert len(dto.banned_champions) == 2
        assert dto.banned_champions[0].name == "Doom"
        assert dto.banned_champions[0].is_saga_attacker is True
        assert dto.banned_champions[1].name == "Quake"
        assert dto.banned_champions[1].has_prefight is True
        assert dto.banned_champions[1].alias == "shaker"

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
        assert dto.image_url == "/img/spider.png"
        assert dto.rarity == "7r3"
        assert dto.ascension == 0
        assert dto.ko_count == 0
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False
        assert dto.placed_by_pseudo == "OfficerPlayer"
        # No attacker
        assert dto.attacker_champion_user_id is None
        assert dto.attacker_pseudo is None
        assert dto.attacker_champion_name is None
        assert dto.attacker_rarity is None
        assert dto.attacker_ascension is None
        assert dto.attacker_is_saga_attacker is None
        assert dto.attacker_is_saga_defender is None
        assert dto.attacker_is_preferred_attacker is None

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

    def test_placement_with_attacker(self):
        attacker = _make_attacker()
        defender = _make_champion(is_saga_defender=True)
        p = _make_placement(champion=defender, attacker=attacker, ko_count=2)
        dto = WarPlacementResponse.model_validate(p)

        # Defender fields
        assert dto.is_saga_defender is True
        assert dto.ko_count == 2

        # Attacker fields
        assert dto.attacker_champion_user_id == attacker.id
        assert dto.attacker_game_account_id == attacker.game_account_id
        assert dto.attacker_pseudo == "AttackerPlayer"
        assert dto.attacker_champion_name == "Hercules"
        assert dto.attacker_champion_class == "Cosmic"
        assert dto.attacker_image_url == "/img/herc.png"
        assert dto.attacker_rarity == "7r3"
        assert dto.attacker_ascension == 1
        assert dto.attacker_is_preferred_attacker is True
        assert dto.attacker_is_saga_attacker is True
        assert dto.attacker_is_saga_defender is False

    def test_placement_saga_defender_champion(self):
        champ = _make_champion(is_saga_attacker=True, is_saga_defender=True)
        p = _make_placement(champion=champ)
        dto = WarPlacementResponse.model_validate(p)
        assert dto.is_saga_attacker is True
        assert dto.is_saga_defender is True

    def test_from_dict_passthrough(self):
        data = {
            "id": uuid.uuid4(),
            "war_id": uuid.uuid4(),
            "battlegroup": 1,
            "node_number": 5,
            "champion_id": uuid.uuid4(),
            "champion_name": "Doom",
            "champion_class": "Mystic",
            "rarity": "7r3",
            "ascension": 0,
            "created_at": datetime(2025, 1, 1),
        }
        dto = WarPlacementResponse.model_validate(data)
        assert dto.champion_name == "Doom"
        assert dto.node_number == 5


def _make_prefight(**overrides):
    champ = _make_champion(name="Quake", image_url=None)
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


def _make_synergy(**overrides):
    champ = _make_champion(name="Nick Fury", champion_class="Skill", image_url="/img/fury.png")
    target_champ = _make_champion(name="Quake", image_url=None)
    cu = _ns(champion=champ, rarity="7r3", ascension=1)
    target_cu = _ns(champion=target_champ, rarity="6r4", ascension=0)
    defaults = {
        "id": uuid.uuid4(),
        "war_id": uuid.uuid4(),
        "battlegroup": 2,
        "game_account_id": uuid.uuid4(),
        "champion_user_id": uuid.uuid4(),
        "target_champion_user_id": uuid.uuid4(),
        "champion_user": cu,
        "target_champion_user": target_cu,
        "game_account": _ns(game_pseudo="SynergyPlayer"),
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

    def test_prefight_saga_champion(self):
        champ = _make_champion(name="Doom", champion_class="Mystic", is_saga_attacker=True)
        cu = _ns(champion=champ, rarity="6r4", ascension=2)
        obj = _make_prefight(champion_user=cu)
        dto = WarPrefightResponse.model_validate(obj)

        assert dto.champion_name == "Doom"
        assert dto.rarity == "6r4"
        assert dto.ascension == 2
        assert dto.is_saga_attacker is True
        assert dto.is_saga_defender is False

    def test_from_dict_passthrough(self):
        data = {
            "id": uuid.uuid4(),
            "war_id": uuid.uuid4(),
            "battlegroup": 1,
            "game_account_id": uuid.uuid4(),
            "champion_user_id": uuid.uuid4(),
            "target_node_number": 10,
            "champion_name": "Quake",
            "champion_class": "Science",
            "rarity": "7r3",
            "game_pseudo": "Player1",
            "created_at": datetime(2025, 1, 1),
        }
        dto = WarPrefightResponse.model_validate(data)
        assert dto.champion_name == "Quake"
        assert dto.target_node_number == 10


# ─── WarSynergyResponse ───────────────────────────────────

class TestWarSynergyResponseDTO:
    def test_synergy_serializes(self):
        obj = _make_synergy()
        dto = WarSynergyResponse.model_validate(obj)

        assert dto.id == obj.id
        assert dto.war_id == obj.war_id
        assert dto.battlegroup == 2
        assert dto.champion_name == "Nick Fury"
        assert dto.champion_class == "Skill"
        assert dto.image_url == "/img/fury.png"
        assert dto.rarity == "7r3"
        assert dto.ascension == 1
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False
        assert dto.target_champion_name == "Quake"
        assert dto.game_pseudo == "SynergyPlayer"

    def test_synergy_saga_champion(self):
        champ = _make_champion(is_saga_attacker=True, is_saga_defender=True)
        cu = _ns(champion=champ, rarity="7r3", ascension=0)
        obj = _make_synergy(champion_user=cu)
        dto = WarSynergyResponse.model_validate(obj)

        assert dto.is_saga_attacker is True
        assert dto.is_saga_defender is True

    def test_from_dict_passthrough(self):
        data = {
            "id": uuid.uuid4(),
            "war_id": uuid.uuid4(),
            "battlegroup": 1,
            "game_account_id": uuid.uuid4(),
            "champion_user_id": uuid.uuid4(),
            "target_champion_user_id": uuid.uuid4(),
            "champion_name": "Nick Fury",
            "champion_class": "Skill",
            "rarity": "7r3",
            "target_champion_name": "Quake",
            "game_pseudo": "Player1",
            "created_at": datetime(2025, 1, 1),
        }
        dto = WarSynergyResponse.model_validate(data)
        assert dto.champion_name == "Nick Fury"
        assert dto.target_champion_name == "Quake"
