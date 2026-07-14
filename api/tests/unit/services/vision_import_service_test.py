import io
import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from src.services.account.game.VisionImportService import (
    MAX_SCREEN_BYTES,
    MAX_SCREENS_PER_IMPORT,
    VisionImportService,
)


class FakeStorage:
    """In-memory Storage. Keeps the service tests free of RustFS."""

    def __init__(self):
        self.puts: list[tuple[str, str, bytes]] = []

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self.puts.append((bucket, key, data))

    async def get_bytes(self, bucket: str, key: str) -> bytes:  # pragma: no cover
        raise NotImplementedError

    async def presign_get(self, bucket: str, key: str, expires_in: int) -> str:  # pragma: no cover
        raise NotImplementedError


def _upload(
    name: str = "shot.png",
    content_type: str = "image/png",
    content: bytes = b"png-bytes",
) -> UploadFile:
    """Build an UploadFile the way Starlette does — content_type is read from the headers."""
    return UploadFile(
        file=io.BytesIO(content),
        filename=name,
        headers=Headers({"content-type": content_type}),
    )


@pytest.mark.asyncio
async def test_create_import_rejects_empty_file_list():
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=[],
            share_dataset=False,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_too_many_files():
    files = [_upload(f"s{i}.png") for i in range(MAX_SCREENS_PER_IMPORT + 1)]
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=files,
            share_dataset=False,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_oversized_screen():
    oversized = _upload("big.png", content=b"0" * (MAX_SCREEN_BYTES + 1))
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=[oversized],
            share_dataset=False,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_unsupported_content_type():
    pdf = _upload("roster.pdf", content_type="application/pdf", content=b"%PDF")
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=[pdf],
            share_dataset=False,
        )
    assert exc.value.status_code == 400
