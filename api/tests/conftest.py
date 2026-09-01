import pytest

from src.models.Base import utcnow


@pytest.fixture
def use_time_machine(time_machine):
    time_machine.move_to(utcnow(), tick=False)
    return time_machine
