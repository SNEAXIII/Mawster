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
    push_member,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import (
    get_generic_user,
    push_user2,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_post_request,
    execute_put_request,
)
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


@pytest.mark.asyncio
async def test_upsert_creates_note_and_revision(session):
    data = await _setup_war_with_placement()
    war = data["war"]
    editor_id = data["owner"].id
    editor_user_id = data["owner"].user_id

    note = await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="first note"),
        editor_account_id=editor_id,
        editor_user_id=editor_user_id,
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
    editor_user_id = data["owner"].user_id

    await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="v1"),
        editor_account_id=editor_id,
        editor_user_id=editor_user_id,
    )
    note = await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="v2"),
        editor_account_id=editor_id,
        editor_user_id=editor_user_id,
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
async def test_delete_soft_deletes_note_and_keeps_history(session):
    data = await _setup_war_with_placement()
    war = data["war"]
    editor_id = data["owner"].id
    editor_user_id = data["owner"].user_id

    note = await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="to delete"),
        editor_account_id=editor_id,
        editor_user_id=editor_user_id,
    )

    await WarFightNoteService.delete_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        editor_user_id=editor_user_id,
    )

    # Row is kept (soft delete), flagged as deleted by the officer.
    await session.refresh(note)
    assert note.deleted_at is not None
    assert note.deleted_by_id == editor_user_id

    # No active note is returned for the node anymore.
    assert (await WarFightNoteService.get_note_for_node(session, war.id, BG, NODE)) is None

    # History preserved: original revision + a deletion snapshot.
    revisions = (
        await session.exec(
            select(WarFightNoteRevision).where(WarFightNoteRevision.note_id == note.id)
        )
    ).all()
    assert len(revisions) == 2
    deletion = next(r for r in revisions if r.is_deletion)
    assert deletion.content == "to delete"
    assert deletion.edited_by_user_id == editor_user_id


@pytest.mark.asyncio
async def test_delete_by_muted_officer_raises_403(session):
    from fastapi import HTTPException

    from src.models.UserMute import UserMute

    data = await _setup_war_with_placement()
    war = data["war"]
    editor_id = data["owner"].id
    editor_user_id = data["owner"].user_id

    await WarFightNoteService.upsert_note(
        session=session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="to delete"),
        editor_account_id=editor_id,
        editor_user_id=editor_user_id,
    )

    session.add(UserMute(user_id=editor_user_id, reason="spam", muted_by_id=editor_user_id))
    await session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await WarFightNoteService.delete_note(
            session=session,
            war=war,
            battlegroup=BG,
            node_number=NODE,
            editor_user_id=editor_user_id,
        )
    assert exc_info.value.status_code == 403

    # Note stays intact.
    assert (await WarFightNoteService.get_note_for_node(session, war.id, BG, NODE)) is not None


@pytest.mark.asyncio
async def test_delete_missing_note_raises_404(session):
    from fastapi import HTTPException

    data = await _setup_war_with_placement()

    with pytest.raises(HTTPException) as exc_info:
        await WarFightNoteService.delete_note(
            session=session,
            war=data["war"],
            battlegroup=BG,
            node_number=NODE,
            editor_user_id=data["owner"].user_id,
        )
    assert exc_info.value.status_code == 404


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
            editor_user_id=data["owner"].user_id,
        )
    assert exc_info.value.status_code == 409


# ─── HTTP-level tests ─────────────────────────────────────


async def _setup_http_war_with_placement():
    """Alliance + owner (officer) + member (non-officer) + active war + defender bg1/node5."""
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()

    alliance, owner = await push_alliance_with_owner(
        user_id=USER_ID,
        game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME,
        alliance_tag=ALLIANCE_TAG,
    )
    await push_officer(alliance, owner)
    member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

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

    return {"alliance": alliance, "owner": owner, "member": member, "war": war}


@pytest.mark.asyncio
async def test_put_note_officer_ok_member_forbidden():
    data = await _setup_http_war_with_placement()
    url = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/nodes/{BG}/{NODE}/note"

    officer_headers = create_auth_headers(user_id=str(USER_ID))
    response = await execute_put_request(
        url,
        payload={"content": "watch out for unblockable"},
        headers=officer_headers,
    )
    assert response.status_code == 200
    assert response.json()["content"] == "watch out for unblockable"

    member_headers = create_auth_headers(user_id=str(USER2_ID))
    forbidden = await execute_put_request(
        url,
        payload={"content": "member should not edit"},
        headers=member_headers,
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_note_visible_in_war_defense_response():
    data = await _setup_http_war_with_placement()
    content = "watch out for unblockable"

    officer_headers = create_auth_headers(user_id=str(USER_ID))
    put_response = await execute_put_request(
        f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/nodes/{BG}/{NODE}/note",
        payload={"content": content},
        headers=officer_headers,
    )
    assert put_response.status_code == 200

    member_headers = create_auth_headers(user_id=str(USER2_ID))
    response = await execute_get_request(
        f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/{BG}",
        headers=member_headers,
    )
    assert response.status_code == 200
    placements = response.json()["placements"]
    node_placement = next(p for p in placements if p["node_number"] == NODE)
    assert node_placement["note"] == content


@pytest.mark.asyncio
async def test_delete_note_officer_ok_member_forbidden():
    data = await _setup_http_war_with_placement()
    url = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/nodes/{BG}/{NODE}/note"

    officer_headers = create_auth_headers(user_id=str(USER_ID))
    created = await execute_put_request(
        url, payload={"content": "delete me"}, headers=officer_headers
    )
    assert created.status_code == 200

    member_headers = create_auth_headers(user_id=str(USER2_ID))
    forbidden = await execute_delete_request(url, headers=member_headers)
    assert forbidden.status_code == 403

    ok = await execute_delete_request(url, headers=officer_headers)
    assert ok.status_code == 204

    # Note no longer surfaced on the node.
    response = await execute_get_request(
        f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/{BG}",
        headers=member_headers,
    )
    node_placement = next(p for p in response.json()["placements"] if p["node_number"] == NODE)
    assert node_placement["note"] is None


@pytest.mark.asyncio
async def test_delete_note_on_ended_war_returns_409():
    data = await _setup_http_war_with_placement()
    url = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/nodes/{BG}/{NODE}/note"
    officer_headers = create_auth_headers(user_id=str(USER_ID))

    created = await execute_put_request(
        url, payload={"content": "delete me"}, headers=officer_headers
    )
    assert created.status_code == 200

    end = await execute_post_request(
        f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
        payload={"win": True},
        headers=officer_headers,
    )
    assert end.status_code == 200

    response = await execute_delete_request(url, headers=officer_headers)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_put_note_on_ended_war_returns_409():
    data = await _setup_http_war_with_placement()
    officer_headers = create_auth_headers(user_id=str(USER_ID))

    end = await execute_post_request(
        f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
        payload={"win": True},
        headers=officer_headers,
    )
    assert end.status_code == 200

    response = await execute_put_request(
        f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/nodes/{BG}/{NODE}/note",
        payload={"content": "too late"},
        headers=officer_headers,
    )
    assert response.status_code == 409
