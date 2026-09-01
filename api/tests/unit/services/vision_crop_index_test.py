from src.services.account.game.VisionImportService import VisionImportService


def test_crop_index_reads_the_sprite_cell_suffix():
    key = "imports/imp/job/crops/sprite_v1.webp#7"

    assert VisionImportService._crop_index(key) == 7


def test_a_legacy_per_crop_key_has_no_sprite_cell():
    """Intended behaviour, not a regression. A pre-sprite key names a per-crop
    object whose route this branch deleted, so resolving it to a cell index would
    point the review screen at bytes nothing can serve — and a failed
    background/img load is silent. `None` is the value the front already renders
    as the champion portrait, so the row degrades to that fallback instead."""
    assert VisionImportService._crop_index("imports/imp/job/crops/3.png") is None


def test_crop_index_is_none_without_a_key():
    assert VisionImportService._crop_index(None) is None


def test_crop_index_is_none_for_an_unparseable_key():
    assert VisionImportService._crop_index("imports/imp/job/crops/sprite_v1.webp") is None
