from datetime import date

import pytest
from fastapi import HTTPException

from src.services.admin.LoginStatsService import LoginStatsService


def test_month_keys_are_contiguous_across_a_year_boundary():
    keys = LoginStatsService.month_keys(date(2026, 11, 2), date(2027, 2, 1))

    assert keys == ["2026-11", "2026-12", "2027-01", "2027-02"]


def test_month_keys_of_one_month_is_that_month_alone():
    assert LoginStatsService.month_keys(date(2026, 5, 31), date(2026, 5, 1)) == ["2026-05"]


def test_zone_for_rejects_an_unknown_name():
    with pytest.raises(HTTPException) as error:
        LoginStatsService.zone_for("Mars/Olympus")
    assert error.value.status_code == 422
