import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import Ascension, Rank, Stars, UUIDBase

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.GameAccount import GameAccount
    from src.models.RequestedUpgrade import RequestedUpgrade


class ChampionUser(UUIDBase, table=True):
    __tablename__ = "champion_user"

    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
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
