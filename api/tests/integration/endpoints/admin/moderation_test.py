"""Integration tests for moderation gating on war fight note editing."""

import uuid
from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import and_, func, select

from src.dto.admin.dto_moderation import NoteReportCreateRequest
from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
from src.enums.NoteReportStatus import NoteReportStatus
from src.models.NoteReport import NoteReport
from src.models.UserMute import UserMute
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.services.admin.ModerationService import ModerationService
from src.services.alliance.war.WarFightNoteService import WarFightNoteService
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_member,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_constant import (
    ALLIANCE_NAME,
    ALLIANCE_TAG,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    USER2_ID,
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


async def _setup_note_and_reporter(session):
    """Build a war + a note on bg1/node5 + a separate reporter game account.

    Returns {note, reporter, owner, war}."""
    data = await _setup_war_with_placement()
    owner = data["owner"]
    war = data["war"]

    note = await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="n"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )

    await push_user2()
    reporter = await push_member(data["alliance"], user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    return {"note": note, "reporter": reporter, "owner": owner, "war": war}


async def _count_pending(session, note_id):
    return (
        await session.exec(
            select(func.count())
            .select_from(NoteReport)
            .where(
                and_(
                    NoteReport.note_id == note_id,
                    NoteReport.status == NoteReportStatus.pending,
                )
            )
        )
    ).one()


@pytest.mark.asyncio
async def test_report_note_creates_pending(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]

    report = await ModerationService.report_note(
        session,
        note_id=note.id,
        reporter_account_id=reporter.id,
        reporter_user_id=reporter.user_id,
        body=NoteReportCreateRequest(reason="bad"),
    )

    assert report.status == NoteReportStatus.pending
    assert await _count_pending(session, note.id) == 1


@pytest.mark.asyncio
async def test_report_note_duplicate_refused(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]

    await ModerationService.report_note(
        session,
        note_id=note.id,
        reporter_account_id=reporter.id,
        reporter_user_id=reporter.user_id,
        body=NoteReportCreateRequest(reason="bad"),
    )

    with pytest.raises(HTTPException) as exc:
        await ModerationService.report_note(
            session,
            note_id=note.id,
            reporter_account_id=reporter.id,
            reporter_user_id=reporter.user_id,
            body=NoteReportCreateRequest(reason="again"),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_report_refused_when_whitelisted(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]

    note.whitelisted_at = datetime.now()
    session.add(note)
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await ModerationService.report_note(
            session,
            note_id=note.id,
            reporter_account_id=reporter.id,
            reporter_user_id=reporter.user_id,
            body=NoteReportCreateRequest(reason="bad"),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_report_refused_when_muted(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]

    session.add(
        UserMute(
            user_id=reporter.user_id,
            reason="spam",
            muted_by_id=reporter.user_id,
        )
    )
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await ModerationService.report_note(
            session,
            note_id=note.id,
            reporter_account_id=reporter.id,
            reporter_user_id=reporter.user_id,
            body=NoteReportCreateRequest(reason="bad"),
        )
    assert exc.value.status_code == 403


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
