from typing import Annotated

from fastapi import Path

BattlegroupPath = Annotated[int, Path(ge=1, le=3)]
