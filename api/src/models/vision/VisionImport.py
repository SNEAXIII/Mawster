from enum import Enum
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import GameAccountFk, TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.user.GameAccount import GameAccount
    from src.models.vision.VisionJob import VisionJob


class VisionImportStatus(str, Enum):
    # Presigned URLs handed out, screenshots not uploaded yet. The import is not
    # runnable and not reviewable — only `commit` moves it to PENDING.
    AWAITING_UPLOAD = "awaiting_upload"
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class VisionImport(UUIDBase, TimestampMixin, GameAccountFk, table=True):
    __tablename__ = "vision_import"

    status: VisionImportStatus = Field(default=VisionImportStatus.PENDING)
    screens_total: int = Field(default=0, ge=0)
    screens_done: int = Field(default=0, ge=0)
    share_dataset: bool = Field(default=False)

    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[VisionImport.game_account_id]"}
    )
    jobs: list["VisionJob"] = Relationship(back_populates="vision_import")

    def status_for_progress(self) -> VisionImportStatus:
        """The status this import's counters say it is in.

        DONE once every screenshot has landed (success or failure), RUNNING while
        some have, PENDING while none have — a batch that is queued but which no
        worker has answered for yet is waiting, not running.

        Lives on the model because two writers reach this conclusion: the worker
        result (a screenshot the pipeline finished) and the import commit (a
        screenshot that will never reach the pipeline at all). Splitting the rule
        between them is how an import ends up spinning forever on one of the two
        paths only.
        """
        if self.screens_done >= self.screens_total:
            return VisionImportStatus.DONE
        if self.screens_done > 0:
            return VisionImportStatus.RUNNING
        return VisionImportStatus.PENDING
