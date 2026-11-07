import uuid
from contextlib import contextmanager

import pytest

from src.models.vision.VisionImport import VisionImport
from src.services.account.game.VisionProgressService import VisionProgressService


class RecordingSession:
    """Autoflushes like the real one: SQLite ignores FOR UPDATE, so order is all a test can see."""

    def __init__(self):
        self.calls: list[str] = []
        self.autoflush = True

    @property
    @contextmanager
    def no_autoflush(self):
        self.autoflush = False
        yield
        self.autoflush = True

    async def exec(self, statement):
        if self.autoflush:
            self.calls.append("flush")
        locking = getattr(statement, "_for_update_arg", None) is not None
        self.calls.append("lock" if locking else "update")

    async def flush(self):
        self.calls.append("flush")

    async def refresh(self, _):
        pass


@pytest.mark.asyncio
async def test_sync_locks_the_import_before_writing_any_job():
    session = RecordingSession()
    vision_import = VisionImport(game_account_id=uuid.uuid4(), screens_total=2)

    await VisionProgressService.sync(session, vision_import)

    assert session.calls[:2] == ["lock", "flush"]
