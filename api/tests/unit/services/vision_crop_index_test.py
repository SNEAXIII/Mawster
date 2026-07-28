from src.services.account.game.VisionImportService import VisionImportService


def test_crop_index_reads_the_sprite_cell_suffix():
    key = "imports/imp/job/crops/sprite_v1.webp#7"

    assert VisionImportService._crop_index(key) == 7


def test_crop_index_still_reads_a_legacy_per_crop_key():
    """Predictions written before the sprite sheet must keep resolving — that is
    what makes this change need no migration and no backfill."""
    assert VisionImportService._crop_index("imports/imp/job/crops/3.png") == 3


def test_crop_index_is_none_without_a_key():
    assert VisionImportService._crop_index(None) is None


def test_crop_index_is_none_for_an_unparseable_key():
    assert VisionImportService._crop_index("imports/imp/job/crops/sprite_v1.webp") is None
