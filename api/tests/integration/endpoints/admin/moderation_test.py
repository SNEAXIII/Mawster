"""Integration tests for moderation gating on war fight note editing."""

import uuid

import pytest
from fastapi import HTTPException

from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
from src.models.UserMute import UserMute
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.services.alliance.war.WarFightNoteService import WarFightNoteService
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_constant import (
    ALLIANCE_NAME,
    ALLIANCE_TAG,
    GAME_PSEUDO,
    USER_ID,
)
from tests.utils.utils_db import load_objects

BG = 1
NODE = 5


async def _setup_war_with_placement():
    """Create alliance + owner (officer) + active war + one defender on bg=1/node=5."""
    await load_objects([get_generic_user(is_base_id=True)])

    alliance, owner = await push_alliance_with_owner(
        user_id=USER_ID,
        game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME,
        alliance_tag=ALLIANCE_TAG,
    )
    await push_officer(alliance, owner)

    champ = await push_champion(name="Spider-Man", champion_class="Science")

    war = War(
        id=uuid.uuid4(),
        alliance_id=alliance.id,
        opponent_name="Enemy Alliance",
        created_by_id=owner.id,
    )
    placement = WarDefensePlacement(
        war_id=war.id,
        battlegroup=BG,
        node_number=NODE,
        champion_id=champ.id,
        stars=7,
        rank=3,
        ascension=0,
    )
    await load_objects([war, placement])

    return {"alliance": alliance, "owner": owner, "war": war, "placement": placement}


@pytest.mark.asyncio
async def test_active_mute_blocks_note_edit(session):
    data = await _setup_war_with_placement()
    owner = data["owner"]
    war = data["war"]

    session.add(
        UserMute(
            user_id=owner.user_id,
            reason="spam",
            muted_by_id=owner.user_id,
        )
    )
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await WarFightNoteService.upsert_note(
            session,
            war=war,
            battlegroup=BG,
            node_number=NODE,
            body=WarFightNoteUpsertRequest(content="x"),
            editor_account_id=owner.id,
            editor_user_id=owner.user_id,
        )
    assert exc.value.status_code == 403
