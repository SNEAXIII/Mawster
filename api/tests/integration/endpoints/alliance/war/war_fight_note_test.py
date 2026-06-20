"""Integration tests for the war fight note service (upsert + revision audit)."""

import uuid

import pytest
from sqlmodel import select

from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightNote import WarFightNote
from src.models.WarFightNoteRevision import WarFightNoteRevision
from src.services.alliance.war.WarFightNoteService import WarFightNoteService
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_constant import ALLIANCE_NAME, ALLIANCE_TAG, GAME_PSEUDO, USER_ID
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
async def test_upsert_creates_note_and_revision(session):
    data = await _setup_war_with_placement()
    war = data["war"]
    editor_id = data["owner"].id

    note = await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="first note"),
        editor_account_id=editor_id,
    )

    assert note.content == "first note"

    notes = (await session.exec(select(WarFightNote).where(WarFightNote.war_id == war.id))).all()
    assert len(notes) == 1

    revisions = (
        await session.exec(
            select(WarFightNoteRevision).where(WarFightNoteRevision.note_id == note.id)
        )
    ).all()
    assert len(revisions) == 1
    assert revisions[0].edited_by_game_account_id == editor_id
    assert revisions[0].content == "first note"


@pytest.mark.asyncio
async def test_upsert_twice_reuses_note_and_adds_revision(session):
    data = await _setup_war_with_placement()
    war = data["war"]
    editor_id = data["owner"].id

    await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="v1"),
        editor_account_id=editor_id,
    )
    note = await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="v2"),
        editor_account_id=editor_id,
    )

    notes = (await session.exec(select(WarFightNote).where(WarFightNote.war_id == war.id))).all()
    assert len(notes) == 1
    assert notes[0].content == "v2"

    revisions = (
        await session.exec(
            select(WarFightNoteRevision).where(WarFightNoteRevision.note_id == note.id)
        )
    ).all()
    assert len(revisions) == 2
    assert {r.content for r in revisions} == {"v1", "v2"}


@pytest.mark.asyncio
async def test_upsert_on_ended_war_raises_409(session):
    from fastapi import HTTPException

    data = await _setup_war_with_placement()
    war = data["war"]
    war.status = WarStatus.ended

    with pytest.raises(HTTPException) as exc_info:
        await WarFightNoteService.upsert_note(
            session=session,
            war=war,
            battlegroup=BG,
            node_number=NODE,
            body=WarFightNoteUpsertRequest(content="too late"),
            editor_account_id=data["owner"].id,
        )
    assert exc_info.value.status_code == 409
