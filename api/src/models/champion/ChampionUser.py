from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import Ascension, ChampionFk, GameAccountFk, Rank, Stars, UUIDBase

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.champion.RequestedUpgrade import RequestedUpgrade
    from src.models.user.GameAccount import GameAccount


class ChampionUser(UUIDBase, ChampionFk, GameAccountFk, table=True):
    __tablename__ = "champion_user"

    stars: Stars = 7
    rank: Rank = 1
    signature: int = Field(default=0, ge=0, le=200)
    is_preferred_attacker: bool = Field(default=False)
    ascension: Ascension = 0

    @property
    def rarity(self) -> str:
        """Build rarity code from stars + rank, e.g. 7 + 5 → '7r5'."""
        return f"{self.stars}r{self.rank}"

    # Relations
    game_account: "GameAccount" = Relationship(back_populates="roster")
    champion: "Champion" = Relationship(back_populates="instances")
    upgrade_requests: list["RequestedUpgrade"] = Relationship(back_populates="champion_user")
