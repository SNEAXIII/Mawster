"""Unit tests for ChampionResponse and ChampionLoadRequest DTOs."""

import uuid
from types import SimpleNamespace

from pydantic import ValidationError
import pytest

from src.dto.admin.dto_champion import ChampionResponse, ChampionLoadRequest


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
        "is_saga_attacker": False,
        "is_saga_defender": False,
        "alias": "spidey;peter",
    }
    defaults.update(overrides)
    return _ns(**defaults)


class TestChampionResponseModelValidate:
    def test_maps_all_fields(self):
        champ = _make_champion()
        dto = ChampionResponse.model_validate(champ)

        assert dto.id == champ.id
        assert dto.name == "Spider-Man"
        assert dto.champion_class == "Science"
        assert dto.image_url == "/img/spider.png"
        assert dto.is_7_star is True
        assert dto.is_ascendable is True
        assert dto.has_prefight is False
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False
        assert dto.alias == "spidey;peter"

    def test_handles_none_optional_fields(self):
        champ = _make_champion(image_url=None, alias=None)
        dto = ChampionResponse.model_validate(champ)

        assert dto.image_url is None
        assert dto.alias is None

    def test_defaults_booleans(self):
        champ = _make_champion(is_7_star=False, is_ascendable=False)
        dto = ChampionResponse.model_validate(champ)

        assert dto.is_7_star is False
        assert dto.is_ascendable is False


class TestChampionLoadRequest:
    def test_bool_flags_default_to_none(self):
        req = ChampionLoadRequest(name="Spider-Man", champion_class="Science")
        assert req.is_ascendable is None
        assert req.has_prefight is None
        assert req.is_saga_attacker is None
        assert req.is_saga_defender is None

    def test_alias_defaults_to_none(self):
        req = ChampionLoadRequest(name="Spider-Man", champion_class="Science")
        assert req.alias is None

    def test_accepts_explicit_true_flags(self):
        req = ChampionLoadRequest(
            name="Hercules",
            champion_class="Cosmic",
            is_ascendable=True,
            has_prefight=True,
            is_saga_attacker=True,
            is_saga_defender=True,
        )
        assert req.is_ascendable is True
        assert req.has_prefight is True
        assert req.is_saga_attacker is True
        assert req.is_saga_defender is True

    def test_accepts_explicit_false_flags(self):
        req = ChampionLoadRequest(
            name="Wolverine",
            champion_class="Mutant",
            is_ascendable=False,
            has_prefight=False,
            is_saga_attacker=False,
            is_saga_defender=False,
        )
        assert req.is_ascendable is False
        assert req.has_prefight is False
        assert req.is_saga_attacker is False
        assert req.is_saga_defender is False

    def test_name_required(self):
        with pytest.raises(ValidationError):
            ChampionLoadRequest(champion_class="Science")

    def test_champion_class_required(self):
        with pytest.raises(ValidationError):
            ChampionLoadRequest(name="Spider-Man")

    def test_alias_max_length(self):
        with pytest.raises(ValidationError):
            ChampionLoadRequest(
                name="Spider-Man",
                champion_class="Science",
                alias="x" * 501,
            )
