from typing import Annotated

from fastapi import Path

BattlegroupPath = Annotated[int, Path(ge=1, le=3)]
NodeNumberPath = Annotated[int, Path(ge=1, le=50)]
