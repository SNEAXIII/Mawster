import logging

import pytest

# aiosqlite narrates every statement, cursor and connection at DEBUG: 27k records for a
# single 25-test file, two orders of magnitude louder than everything else in the suite,
# and nothing asserts on any of it. Silenced here rather than in `logging_config` because
# the driver only ever runs under test — the app itself talks to MariaDB.
logging.getLogger("aiosqlite").setLevel(logging.WARNING)

from src.models.Base import utcnow  # noqa: E402 — must follow the logging setup above


@pytest.fixture
def use_time_machine(time_machine):
    time_machine.move_to(utcnow(), tick=False)
    return time_machine
