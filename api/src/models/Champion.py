import uuid
from typing import List, Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.ChampionUser import ChampionUser


class Champion(SQLModel, table=True):
    __tablename__ = "champion"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100, unique=True)
    champion_class: str = Field(max_length=20)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_7_star: bool = Field(default=False)
    alias: Optional[str] = Field(default=None, max_length=500)

    # Relations
    instances: List["ChampionUser"] = Relationship(back_populates="champion")
