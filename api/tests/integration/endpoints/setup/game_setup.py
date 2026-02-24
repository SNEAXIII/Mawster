"""Setup helpers to create game accounts, alliances, officers and members for integration tests."""
import uuid
from typing import Optional

from src.models.Alliance import Alliance
from src.models.AllianceOfficer import AllianceOfficer
from src.models.GameAccount import GameAccount
from tests.utils.utils_constant import (
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    ALLIANCE_NAME,
    ALLIANCE_TAG,
    USER_ID,
)
from tests.utils.utils_db import load_objects


# ---------------------------------------------------------------------------
# Game Accounts
# ---------------------------------------------------------------------------

def get_game_account(
    user_id: uuid.UUID = USER_ID,
    game_pseudo: str = GAME_PSEUDO,
    is_primary: bool = False,
    alliance_id: Optional[uuid.UUID] = None,
    alliance_group: Optional[int] = None,
    account_id: Optional[uuid.UUID] = None,
) -> GameAccount:
    return GameAccount(
        id=account_id or uuid.uuid4(),
        user_id=user_id,
        game_pseudo=game_pseudo,
        is_primary=is_primary,
        alliance_id=alliance_id,
        alliance_group=alliance_group,
    )


# ---------------------------------------------------------------------------
# Alliances
# ---------------------------------------------------------------------------

def get_alliance(
    owner_id: uuid.UUID,
    name: str = ALLIANCE_NAME,
    tag: str = ALLIANCE_TAG,
    alliance_id: Optional[uuid.UUID] = None,
) -> Alliance:
    return Alliance(
        id=alliance_id or uuid.uuid4(),
        name=name,
        tag=tag,
        owner_id=owner_id,
    )


def get_officer(
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
) -> AllianceOfficer:
    return AllianceOfficer(
        id=uuid.uuid4(),
        alliance_id=alliance_id,
        game_account_id=game_account_id,
    )


# ---------------------------------------------------------------------------
# Composite setup helpers
# ---------------------------------------------------------------------------

async def push_game_account(
    user_id: uuid.UUID = USER_ID,
    game_pseudo: str = GAME_PSEUDO,
    is_primary: bool = False,
    alliance_id: Optional[uuid.UUID] = None,
) -> GameAccount:
    """Insert a single game account into the test DB and return it."""
    acc = get_game_account(
        user_id=user_id,
        game_pseudo=game_pseudo,
        is_primary=is_primary,
        alliance_id=alliance_id,
    )
    await load_objects([acc])
    return acc


async def push_alliance_with_owner(
    user_id: uuid.UUID = USER_ID,
    game_pseudo: str = GAME_PSEUDO,
    alliance_name: str = ALLIANCE_NAME,
    alliance_tag: str = ALLIANCE_TAG,
) -> tuple[Alliance, GameAccount]:
    """Create a game account as owner, then create an alliance owned by it.
    The owner is automatically a member of the alliance.
    Returns (alliance, owner_account)."""
    owner_acc = get_game_account(user_id=user_id, game_pseudo=game_pseudo, is_primary=True)
    alliance = get_alliance(owner_id=owner_acc.id, name=alliance_name, tag=alliance_tag)
    # The owner must be a member of the alliance
    owner_acc.alliance_id = alliance.id
    # Alliance must be inserted before the game account referencing it (FK),
    # but SQLite with FK off is fine. We insert alliance first.
    await load_objects([alliance, owner_acc])
    return alliance, owner_acc


async def push_member(
    alliance: Alliance,
    user_id: uuid.UUID,
    game_pseudo: str = GAME_PSEUDO_2,
    is_primary: bool = False,
) -> GameAccount:
    """Add a member to an existing alliance. Returns the new game account."""
    member = get_game_account(
        user_id=user_id,
        game_pseudo=game_pseudo,
        is_primary=is_primary,
        alliance_id=alliance.id,
    )
    await load_objects([member])
    return member


async def push_officer(
    alliance: Alliance,
    game_account: GameAccount,
) -> AllianceOfficer:
    """Promote an existing alliance member to officer. Returns the AllianceOfficer row."""
    officer = get_officer(alliance_id=alliance.id, game_account_id=game_account.id)
    await load_objects([officer])
    return officer
