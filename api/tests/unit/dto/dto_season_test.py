"""Unit tests for season DTO validation."""

import pytest
from pydantic import ValidationError

from src.dto.admin.dto_season import SeasonCreateRequest


class TestSeasonCreateRequest:
    def test_valid_number(self):
        obj = SeasonCreateRequest(number=50)
        assert obj.number == 50

    def test_min_boundary(self):
        obj = SeasonCreateRequest(number=1)
        assert obj.number == 1

    def test_max_boundary(self):
        obj = SeasonCreateRequest(number=9999)
        assert obj.number == 9999

    def test_zero_raises(self):
        with pytest.raises(ValidationError):
            SeasonCreateRequest(number=0)

    def test_negative_raises(self):
        with pytest.raises(ValidationError):
            SeasonCreateRequest(number=-1)

    def test_above_max_raises(self):
        with pytest.raises(ValidationError):
            SeasonCreateRequest(number=10000)

    def test_missing_number_raises(self):
        with pytest.raises(ValidationError):
            SeasonCreateRequest()
