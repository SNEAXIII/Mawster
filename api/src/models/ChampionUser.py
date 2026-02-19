from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.GameAccount import GameAccount
    from src.models.Champion import Champion


class ChampionUser(SQLModel, table=True):
    __tablename__ = "champion_user"

    id: Optional[int] = Field(default=None, primary_key=True)
    game_account_id: int = Field(foreign_key="game_account.id")
    champion_id: int = Field(foreign_key="champion.id")
    stars: int = Field(default=0)
    rank: int = Field(default=1)
    level: int = Field(default=1)
    signature: int = Field(default=0)

    # Relations
    game_account: "GameAccount" = Relationship(back_populates="roster")
    champion: "Champion" = Relationship(back_populates="instances")
