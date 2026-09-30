import uuid

import pytest
from pydantic import ValidationError

from src.dto.account.game.dto_mastery import GameAccountMasteryUpsertItem


class TestGameAccountMasteryUpsertItem:
    def test_valid(self):
        item = GameAccountMasteryUpsertItem(
            mastery_id=uuid.uuid4(), unlocked=4, attack=4, defense=2
        )
        assert item.unlocked == 4

    def test_negative_unlocked_invalid(self):
        mastery_id = uuid.uuid4()

        with pytest.raises(ValidationError):
            GameAccountMasteryUpsertItem(mastery_id=mastery_id, unlocked=-1, attack=0, defense=0)

    def test_negative_attack_invalid(self):
        mastery_id = uuid.uuid4()

        with pytest.raises(ValidationError):
            GameAccountMasteryUpsertItem(mastery_id=mastery_id, unlocked=3, attack=-1, defense=0)
