import uuid
from enum import Enum
from typing import List, TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.GameAccount import GameAccount
    from src.models.VisionJob import VisionJob


class VisionImportStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CONFIRMED = "confirmed"


class VisionImport(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "vision_import"

    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    status: VisionImportStatus = Field(default=VisionImportStatus.PENDING)
    screens_total: int = Field(default=0, ge=0)
    screens_done: int = Field(default=0, ge=0)
    share_dataset: bool = Field(default=False)

    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[VisionImport.game_account_id]"}
    )
    jobs: List["VisionJob"] = Relationship(back_populates="vision_import")
