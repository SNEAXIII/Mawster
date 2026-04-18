import uuid
from sqlmodel import Field, SQLModel


class Season(SQLModel, table=True):
    __tablename__ = "season"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    number: int = Field(unique=True)
    is_active: bool = Field(default=False)
    # TODO (Approach B): add started_at: datetime and ended_at: Optional[datetime]
    # Active season = started_at IS NOT NULL AND ended_at IS NULL
    # This enables automated activation/deactivation based on the game calendar.
