"""Unit tests for SeasonCreateRequest DTO validation."""
import pytest
from pydantic import ValidationError

from src.dto.dto_season import SeasonCreateRequest


class TestSeasonCreateRequest:
    def test_valid_number(self):
        req = SeasonCreateRequest(number=64)
        assert req.number == 64

    def test_number_must_be_positive(self):
        with pytest.raises(ValidationError):
            SeasonCreateRequest(number=0)

    def test_number_negative_raises(self):
        with pytest.raises(ValidationError):
            SeasonCreateRequest(number=-1)

    def test_number_required(self):
        with pytest.raises(ValidationError):
            SeasonCreateRequest()
