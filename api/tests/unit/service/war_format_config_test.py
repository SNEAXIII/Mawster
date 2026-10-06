"""Unit tests for WarFormatConfig presets."""

from src.enums.SeasonFormat import SeasonFormat
from src.services.alliance.war.WarFormatConfig import for_format


class TestWarFormatConfig:
    def test_regular_preset(self):
        params = for_format(SeasonFormat.REGULAR)
        assert params.max_defenders_per_player == 5
        assert params.max_attackers_per_member == 3
        assert params.node_count == 50
        assert params.max_ko_count == 3

    def test_big_thing_preset(self):
        params = for_format(SeasonFormat.BIG_THING)
        assert params.max_defenders_per_player == 1
        assert params.max_attackers_per_member == 2
        assert params.node_count == 10
        assert params.max_ko_count == 10
