"""Unit tests for GameAccountResponse DTO model_validate with from_attributes."""

import uuid
from datetime import datetime
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from src.dto.account.game.dto_game_account import GameAccountCreateRequest, GameAccountResponse


# ---------------------------------------------------------------------------
# Helpers — lightweight namespace objects that mimic ORM models
# ---------------------------------------------------------------------------

TEST_ALLIANCE_NAME = "Test Alliance"


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


# ---------------------------------------------------------------------------
# GameAccountCreateRequest — alphanumeric validation
# ---------------------------------------------------------------------------


class TestGameAccountCreateRequest:
    def test_valid_simple(self):
        dto = GameAccountCreateRequest(game_pseudo="DrBalise", is_primary=False)
        assert dto.game_pseudo == "DrBalise"

    def test_valid_with_space(self):
        dto = GameAccountCreateRequest(game_pseudo="Dr Balise", is_primary=False)
        assert dto.game_pseudo == "Dr Balise"

    def test_rejects_special_chars(self):
        with pytest.raises(ValidationError):
            GameAccountCreateRequest(game_pseudo="Dr-Balise!", is_primary=False)

    def test_rejects_underscore(self):
        with pytest.raises(ValidationError):
            GameAccountCreateRequest(game_pseudo="Dr_Balise", is_primary=False)


# ---------------------------------------------------------------------------
# GameAccountResponse.model_validate
# ---------------------------------------------------------------------------


class TestGameAccountResponseModelValidate:
    def test_with_alliance(self):
        now = datetime.now()
        alliance = _ns(tag="TST", name=TEST_ALLIANCE_NAME)
        account = _ns(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            alliance_group=2,
            alliance=alliance,
            game_pseudo="DrBalise",
            is_primary=True,
            created_at=now,
        )
        dto = GameAccountResponse.model_validate(account)

        assert dto.alliance_tag == "TST"
        assert dto.alliance_name == TEST_ALLIANCE_NAME
        assert dto.game_pseudo == "DrBalise"
        assert dto.is_primary is True

    def test_without_alliance(self):
        now = datetime.now()
        account = _ns(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            alliance_id=None,
            alliance_group=None,
            game_pseudo="Solo",
            is_primary=False,
            created_at=now,
        )
        # No alliance attribute at all
        dto = GameAccountResponse.model_validate(account)

        assert dto.alliance_tag is None
        assert dto.alliance_name is None
        assert dto.alliance_id is None
