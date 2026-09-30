from typing import Annotated

from fastapi import Path

from src.game_types import BATTLEGROUP_MAX, BATTLEGROUP_MIN, NODE_NUMBER_MAX, NODE_NUMBER_MIN

BattlegroupPath = Annotated[int, Path(ge=BATTLEGROUP_MIN, le=BATTLEGROUP_MAX)]
NodeNumberPath = Annotated[int, Path(ge=NODE_NUMBER_MIN, le=NODE_NUMBER_MAX)]
