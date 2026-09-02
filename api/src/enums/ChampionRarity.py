from enum import Enum


class ChampionRarity(str, Enum):
    """A rank-up target, spelled the way the game does: stars + rank, e.g. "7r3".

    The code is the wire format; `stars` and `rank` are what gets stored, so a
    rarity never lives in the database as free text.
    """

    SIX_R4 = "6r4"
    SIX_R5 = "6r5"
    SEVEN_R1 = "7r1"
    SEVEN_R2 = "7r2"
    SEVEN_R3 = "7r3"
    SEVEN_R4 = "7r4"
    SEVEN_R5 = "7r5"
    SEVEN_R6 = "7r6"

    @property
    def stars(self) -> int:
        return int(self.value[0])

    @property
    def rank(self) -> int:
        return int(self.value[2])

    @property
    def order(self) -> tuple[int, int]:
        """Sort key: a rarity is higher than another when (stars, rank) is."""
        return (self.stars, self.rank)

    @classmethod
    def from_code(cls, code: str) -> ChampionRarity | None:
        """Parse a rarity code, case-insensitively. None when it is not a rarity."""
        try:
            return cls(code.strip().lower())
        except ValueError:
            return None

    @classmethod
    def from_parts(cls, stars: int, rank: int) -> ChampionRarity | None:
        """Rarity for a stars/rank pair, or None when the pair is not requestable."""
        return cls.from_code(f"{stars}r{rank}")
