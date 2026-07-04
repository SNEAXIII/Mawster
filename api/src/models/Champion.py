from typing import List, Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.ChampionUser import ChampionUser
    from src.models.ChampionSagaRole import ChampionSagaRole


class Champion(UUIDBase, table=True):
    __tablename__ = "champion"

    name: str = Field(max_length=100, unique=True)
    champion_class: str = Field(max_length=20)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_7_star: bool = Field(default=False)
    is_ascendable: bool = Field(default=False)
    has_prefight: bool = Field(default=False)
    alias: Optional[str] = Field(default=None, max_length=500)

    # Relations
    instances: List["ChampionUser"] = Relationship(back_populates="champion")
    saga_roles: List["ChampionSagaRole"] = Relationship(
        back_populates="champion", cascade_delete=True
    )
