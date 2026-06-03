"""Unit tests for SeasonCreateRequest DTO validation."""

import uuid

import pytest
from pydantic import ValidationError

from src.dto.admin.dto_season import SeasonCreateRequest, SeasonResponse
from src.enums.SeasonFormat import SeasonFormat
from src.models.Season import Season


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


class TestSeasonFormat:
    def test_create_request_defaults_to_regular(self):
        req = SeasonCreateRequest(number=5)
        assert req.format == SeasonFormat.regular

    def test_create_request_accepts_big_thing(self):
        req = SeasonCreateRequest(number=5, format=SeasonFormat.big_thing)
        assert req.format == SeasonFormat.big_thing

    def test_response_exposes_regular_limits(self):
        season = Season(id=uuid.uuid4(), number=1, is_active=True, format=SeasonFormat.regular)
        resp = SeasonResponse.model_validate(season)
        assert resp.format == SeasonFormat.regular
        assert resp.max_defenders_per_player == 5
        assert resp.max_attackers_per_member == 3
        assert resp.node_count == 50

    def test_response_exposes_big_thing_limits(self):
        season = Season(id=uuid.uuid4(), number=2, is_active=True, format=SeasonFormat.big_thing)
        resp = SeasonResponse.model_validate(season)
        assert resp.max_defenders_per_player == 1
        assert resp.max_attackers_per_member == 2
        assert resp.node_count == 10
