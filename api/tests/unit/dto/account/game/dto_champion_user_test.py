"""Unit tests for champion-related DTO model_validate with from_attributes."""

import uuid
from datetime import datetime
from types import SimpleNamespace

import pytest

from src.dto.account.game.dto_champion_user import (
    ChampionUserBulkEntry,
    ChampionUserCreateRequest,
    ChampionUserDetailResponse,
    ChampionUserResponse,
)
from src.dto.account.game.dto_upgrade_request import UpgradeRequestResponse


# ---------------------------------------------------------------------------
# Helpers — lightweight namespace objects that mimic ORM models
# ---------------------------------------------------------------------------


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


def _make_champion(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "name": "Spider-Man",
        "champion_class": "Science",
        "image_url": "/img/spider.png",
        "is_7_star": True,
        "is_ascendable": True,
        "has_prefight": False,
        "alias": "spidey;peter",
    }
    defaults.update(overrides)
    return _ns(**defaults)


def _make_champion_user(champion=None, **overrides):
    champ = champion or _make_champion()
    defaults = {
        "id": uuid.uuid4(),
        "game_account_id": uuid.uuid4(),
        "champion_id": champ.id,
        "stars": 7,
        "rank": 3,
        "signature": 200,
        "is_preferred_attacker": True,
        "ascension": 1,
        "champion": champ,
    }
    defaults.update(overrides)
    obj = _ns(**defaults)
    obj.rarity = f"{obj.stars}r{obj.rank}"
    return obj


# ---------------------------------------------------------------------------
# ChampionUserResponse.model_validate
# ---------------------------------------------------------------------------


class TestChampionUserResponseModelValidate:
    def test_maps_all_fields(self):
        cu = _make_champion_user()
        dto = ChampionUserResponse.model_validate(cu)

        assert dto.id == cu.id
        assert dto.game_account_id == cu.game_account_id
        assert dto.champion_id == cu.champion_id
        assert dto.rarity == "7r3"
        assert dto.signature == 200
        assert dto.is_preferred_attacker is True
        assert dto.ascension == 1

    def test_default_values(self):
        cu = _make_champion_user(is_preferred_attacker=False, ascension=0)
        dto = ChampionUserResponse.model_validate(cu)

        assert dto.is_preferred_attacker is False
        assert dto.ascension == 0


# ---------------------------------------------------------------------------
# ChampionUserDetailResponse.model_validate
# ---------------------------------------------------------------------------


class TestChampionUserDetailResponseModelValidate:
    def test_maps_champion_user_and_champion_fields(self):
        champ = _make_champion(
            name="Doom",
            champion_class="Mystic",
            is_ascendable=True,
        )
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.model_validate(cu)

        # ChampionUser fields
        assert dto.id == cu.id
        assert dto.rarity == "7r3"
        assert dto.signature == 200
        assert dto.is_preferred_attacker is True
        assert dto.ascension == 1

        # Champion fields
        assert dto.champion_name == "Doom"
        assert dto.champion_class == "Mystic"
        assert dto.is_ascendable is True
        assert dto.image_url == champ.image_url

    def test_inherits_from_champion_user_response(self):
        assert issubclass(ChampionUserDetailResponse, ChampionUserResponse)

    def test_non_ascendable_champion(self):
        champ = _make_champion(is_ascendable=False)
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.model_validate(cu)

        assert dto.is_ascendable is False

    def test_saga_defaults_false_and_is_not_read_from_champion(self):
        """Saga flags are resolved per-season by the controller (SagaService), not
        from the (now-removed) champion-level columns. model_validate must never
        read them off `.champion`, and must always default to False."""
        champ = _make_champion()
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.model_validate(cu)

        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False

    def test_saga_fields_settable_after_validation(self):
        """The controller sets these post-validation from SagaService.resolve_current."""
        cu = _make_champion_user()
        dto = ChampionUserDetailResponse.model_validate(cu)
        dto.is_saga_attacker, dto.is_saga_defender = True, True

        assert dto.is_saga_attacker is True
        assert dto.is_saga_defender is True

    def test_from_dict_passthrough(self):
        data = {
            "id": uuid.uuid4(),
            "game_account_id": uuid.uuid4(),
            "champion_id": uuid.uuid4(),
            "rarity": "7r3",
            "signature": 200,
            "is_preferred_attacker": True,
            "ascension": 1,
            "champion_name": "Doom",
            "champion_class": "Mystic",
        }
        dto = ChampionUserDetailResponse.model_validate(data)
        assert dto.champion_name == "Doom"
        assert dto.rarity == "7r3"


# ---------------------------------------------------------------------------
# UpgradeRequestResponse.model_validate
# ---------------------------------------------------------------------------


class TestUpgradeRequestResponseModelValidate:
    def test_maps_all_fields(self):
        now = datetime.now()
        champ = _make_champion(name="Hercules", champion_class="Cosmic")
        cu = _make_champion_user(champion=champ, stars=7, rank=2)
        requester = _ns(game_pseudo="DrBalise")
        req = _ns(
            id=uuid.uuid4(),
            champion_user_id=cu.id,
            requester_game_account_id=uuid.uuid4(),
            requester=requester,
            requested_rarity="7r3",
            champion_user=cu,
            created_at=now,
            done_at=None,
        )
        dto = UpgradeRequestResponse.model_validate(req)

        assert dto.id == req.id
        assert dto.requester_pseudo == "DrBalise"
        assert dto.requested_rarity == "7r3"
        assert dto.current_rarity == "7r2"
        assert dto.champion_name == "Hercules"
        assert dto.champion_class == "Cosmic"
        assert dto.image_url == champ.image_url
        assert dto.created_at == now
        assert dto.done_at is None

    def test_done_request(self):
        now = datetime.now()
        champ = _make_champion()
        cu = _make_champion_user(champion=champ)
        req = _ns(
            id=uuid.uuid4(),
            champion_user_id=cu.id,
            requester_game_account_id=uuid.uuid4(),
            requester=_ns(game_pseudo="X"),
            requested_rarity="7r4",
            champion_user=cu,
            created_at=now,
            done_at=now,
        )
        dto = UpgradeRequestResponse.model_validate(req)
        assert dto.done_at == now


# ---------------------------------------------------------------------------
# ChampionUserCreateRequest — signature bounds
# ---------------------------------------------------------------------------


_BASE_CREATE = {
    "game_account_id": uuid.uuid4(),
    "champion_id": uuid.uuid4(),
    "rarity": "7r3",
}


class TestChampionUserCreateRequestSignature:
    def test_sig_zero(self):
        dto = ChampionUserCreateRequest(**_BASE_CREATE, signature=0)
        assert dto.signature == 0

    def test_sig_max(self):
        dto = ChampionUserCreateRequest(**_BASE_CREATE, signature=200)
        assert dto.signature == 200

    def test_sig_mid(self):
        dto = ChampionUserCreateRequest(**_BASE_CREATE, signature=100)
        assert dto.signature == 100

    def test_sig_above_max_rejected(self):
        with pytest.raises(Exception):
            ChampionUserCreateRequest(**_BASE_CREATE, signature=201)

    def test_sig_negative_rejected(self):
        with pytest.raises(Exception):
            ChampionUserCreateRequest(**_BASE_CREATE, signature=-1)

    def test_sig_default_is_zero(self):
        dto = ChampionUserCreateRequest(**_BASE_CREATE)
        assert dto.signature == 0


# ---------------------------------------------------------------------------
# ChampionUserBulkEntry — signature bounds
# ---------------------------------------------------------------------------


_BASE_BULK = {"champion_name": "Doom", "rarity": "7r3"}


class TestChampionUserBulkEntrySignature:
    def test_sig_zero(self):
        dto = ChampionUserBulkEntry(**_BASE_BULK, signature=0)
        assert dto.signature == 0

    def test_sig_max(self):
        dto = ChampionUserBulkEntry(**_BASE_BULK, signature=200)
        assert dto.signature == 200

    def test_sig_above_max_rejected(self):
        with pytest.raises(Exception):
            ChampionUserBulkEntry(**_BASE_BULK, signature=201)

    def test_sig_negative_rejected(self):
        with pytest.raises(Exception):
            ChampionUserBulkEntry(**_BASE_BULK, signature=-1)

    def test_sig_default_is_zero(self):
        dto = ChampionUserBulkEntry(**_BASE_BULK)
        assert dto.signature == 0
