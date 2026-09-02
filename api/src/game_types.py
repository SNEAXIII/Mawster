"""Bounded scalar types of the game domain.

Single source of truth for every in-game range. Both the SQLModel tables and the
Pydantic DTOs annotate their fields with these, so a bound can never drift between
what the API accepts and what the database stores.

Deliberately free of any table or ORM declaration: a DTO importing from here pulls in
no model.
"""

from typing import Annotated

from sqlmodel import Field

# War-grid coordinates.
Battlegroup = Annotated[int, Field(ge=1, le=3)]
NodeNumber = Annotated[int, Field(ge=1, le=50)]

# War bracket — 1 is the top, 20 the bottom and the starting point of a fresh alliance.
Tier = Annotated[int, Field(ge=1, le=20)]

# Champion stats, as the game ranks them.
Stars = Annotated[int, Field(ge=6, le=7)]
Rank = Annotated[int, Field(ge=1, le=6)]
Ascension = Annotated[int, Field(ge=0, le=2)]
Signature = Annotated[int, Field(ge=0, le=200)]

KoCount = Annotated[int, Field(ge=0)]
