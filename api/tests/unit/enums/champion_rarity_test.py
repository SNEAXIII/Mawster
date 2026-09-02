"""Unit tests for the ChampionRarity enum."""

import pytest

from src.enums.ChampionRarity import ChampionRarity


class TestParts:
    @pytest.mark.parametrize(
        ("rarity", "stars", "rank"),
        [
            (ChampionRarity.SIX_R4, 6, 4),
            (ChampionRarity.SIX_R5, 6, 5),
            (ChampionRarity.SEVEN_R1, 7, 1),
            (ChampionRarity.SEVEN_R6, 7, 6),
        ],
    )
    def test_stars_and_rank(self, rarity, stars, rank):
        assert rarity.stars == stars
        assert rarity.rank == rank
        assert rarity.order == (stars, rank)

    def test_order_ranks_stars_before_rank(self):
        """A star level always outranks a rank: 6r5 is below 7r1."""
        assert ChampionRarity.SIX_R5.order < ChampionRarity.SEVEN_R1.order
        assert ChampionRarity.SEVEN_R3.order < ChampionRarity.SEVEN_R4.order

    def test_order_is_the_declaration_order(self):
        rarities = list(ChampionRarity)
        assert sorted(rarities, key=lambda r: r.order) == rarities


class TestFromCode:
    @pytest.mark.parametrize("code", ["7r3", "7R3", " 7r3 "])
    def test_accepts_case_and_padding(self, code):
        assert ChampionRarity.from_code(code) is ChampionRarity.SEVEN_R3

    @pytest.mark.parametrize("code", ["invalid", "", "8r1", "6r1", "7r7", "7-3"])
    def test_rejects_non_rarities(self, code):
        assert ChampionRarity.from_code(code) is None


class TestFromParts:
    def test_known_pair(self):
        assert ChampionRarity.from_parts(7, 4) is ChampionRarity.SEVEN_R4

    def test_pair_outside_the_requestable_range(self):
        """6r1 is a real champion state, but not something an officer can request."""
        assert ChampionRarity.from_parts(6, 1) is None
