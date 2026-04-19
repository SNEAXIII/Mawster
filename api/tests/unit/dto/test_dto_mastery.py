import pytest
import uuid
from pydantic import ValidationError
from src.dto.dto_mastery import (
    MasteryCreateRequest,
    MasteryUpdateRequest,
    GameAccountMasteryUpsertItem,
)


class TestMasteryCreateRequest:
    def test_valid(self):
        m = MasteryCreateRequest(name="ASSASSIN", max_value=6, order=0)
        assert m.name == "ASSASSIN"
        assert m.max_value == 6

    def test_max_value_zero_invalid(self):
        with pytest.raises(ValidationError):
            MasteryCreateRequest(name="ASSASSIN", max_value=0)

    def test_name_empty_invalid(self):
        with pytest.raises(ValidationError):
            MasteryCreateRequest(name="", max_value=6)


class TestMasteryUpdateRequest:
    def test_valid(self):
        m = MasteryUpdateRequest(name="RECOIL", order=1)
        assert m.name == "RECOIL"

    def test_name_empty_invalid(self):
        with pytest.raises(ValidationError):
            MasteryUpdateRequest(name="", order=0)


class TestGameAccountMasteryUpsertItem:
    def test_valid(self):
        item = GameAccountMasteryUpsertItem(
            mastery_id=uuid.uuid4(), unlocked=4, attack=4, defense=2
        )
        assert item.unlocked == 4

    def test_negative_unlocked_invalid(self):
        with pytest.raises(ValidationError):
            GameAccountMasteryUpsertItem(
                mastery_id=uuid.uuid4(), unlocked=-1, attack=0, defense=0
            )

    def test_negative_attack_invalid(self):
        with pytest.raises(ValidationError):
            GameAccountMasteryUpsertItem(
                mastery_id=uuid.uuid4(), unlocked=3, attack=-1, defense=0
            )
