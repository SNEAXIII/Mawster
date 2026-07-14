import uuid

from src.storage.base import crop_key, result_key, screen_key

IMPORT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
JOB_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def test_screen_key_layout():
    assert screen_key(IMPORT_ID, JOB_ID) == (
        "imports/11111111-1111-1111-1111-111111111111/"
        "22222222-2222-2222-2222-222222222222/screen.png"
    )


def test_result_key_layout():
    assert result_key(IMPORT_ID, JOB_ID) == (
        "imports/11111111-1111-1111-1111-111111111111/"
        "22222222-2222-2222-2222-222222222222/result.json"
    )


def test_crop_key_layout():
    assert crop_key(IMPORT_ID, JOB_ID, 3) == (
        "imports/11111111-1111-1111-1111-111111111111/"
        "22222222-2222-2222-2222-222222222222/crops/3.png"
    )
