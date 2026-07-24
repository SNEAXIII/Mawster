import pytest

from src.models.Base import utcnow


@pytest.fixture(scope="function")
def use_time_machine(time_machine):
    time_machine.move_to(utcnow(), tick=False)
    yield time_machine
