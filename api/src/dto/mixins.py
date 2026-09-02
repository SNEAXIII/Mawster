"""Field groups shared by several DTOs.

The same reason the models keep their FK mixins in ``models.Base``: a group of fields
spelled out in ten response schemas is a group that will drift. These carry no
validation bounds — they describe what the API returns, and a response should never
reject data the database already holds.
"""

import uuid

from pydantic import BaseModel


class PlayerIdentity(BaseModel):
    """The player a row belongs to, as every response spells them out."""

    game_account_id: uuid.UUID
    game_pseudo: str


class WarCoords(BaseModel):
    """Where on the war map a row sits."""

    battlegroup: int
    node_number: int
