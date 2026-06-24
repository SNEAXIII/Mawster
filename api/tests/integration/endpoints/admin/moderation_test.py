"""Integration tests for moderation gating on war fight note editing."""

import uuid
from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import and_, func, select

from src.dto.admin.dto_moderation import (
    MuteCreateRequest,
    NoteReportCreateRequest,
    ReportResolveRequest,
    WarnCreateRequest,
)
from src.enums.Roles import Roles
from src.models.User import User
from src.models.UserWarn import UserWarn
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
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_post_request,
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
async def test_edit_clears_whitelist_but_keeps_reports_pending(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]
    owner = data["owner"]
    war = data["war"]

    await ModerationService.report_note(
        session,
        note_id=note.id,
        reporter_account_id=reporter.id,
        reporter_user_id=reporter.user_id,
        body=NoteReportCreateRequest(reason="bad"),
    )

    note.whitelisted_at = datetime.now()
    session.add(note)
    await session.commit()

    await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="edited"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )

    await session.refresh(note)
    assert note.whitelisted_at is None
    # Editing no longer invalidates reports: they stay pending for admin review.
    assert await _count_pending(session, note.id) == 1


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


async def _push_admin(session):
    """Create a standalone admin user; only its id is needed for moderation actions."""
    admin = User(
        id=uuid.uuid4(),
        login="modadmin",
        email_hash="modadmin_hash",
        discord_id=999999,
        role=Roles.ADMIN,
    )
    session.add(admin)
    await session.commit()
    await session.refresh(admin)
    return admin


async def _push_pending_report(session, note_id, reporter):
    return await ModerationService.report_note(
        session,
        note_id=note_id,
        reporter_account_id=reporter.id,
        reporter_user_id=reporter.user_id,
        body=NoteReportCreateRequest(reason="bad"),
    )


@pytest.mark.asyncio
async def test_resolve_delete_soft_deletes_note(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    report = await _push_pending_report(session, note.id, data["reporter"])
    admin = await _push_admin(session)

    await ModerationService.resolve_report(
        session,
        report_id=report.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="delete"),
    )

    await session.refresh(note)
    await session.refresh(report)
    assert note.deleted_at is not None
    assert report.status == NoteReportStatus.resolved


@pytest.mark.asyncio
async def test_delete_records_deletion_in_history(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    owner = data["owner"]
    war = data["war"]
    report = await _push_pending_report(session, note.id, data["reporter"])
    admin = await _push_admin(session)

    await ModerationService.resolve_report(
        session,
        report_id=report.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="delete"),
    )

    revs = await ModerationService.get_revisions(session, note.id)
    deletions = [r for r in revs if r.is_deletion]
    assert len(deletions) == 1
    assert deletions[0].edited_by_pseudo == admin.login
    # Admin deletions have no contributor to mute/warn.
    assert deletions[0].edited_by_user_id is None

    # Reactivating the note must keep the deletion entry in the history.
    await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="back"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )
    revs_after = await ModerationService.get_revisions(session, note.id)
    assert any(r.is_deletion for r in revs_after)


@pytest.mark.asyncio
async def test_editing_deleted_note_reactivates_it(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    owner = data["owner"]
    war = data["war"]
    report = await _push_pending_report(session, note.id, data["reporter"])
    admin = await _push_admin(session)

    await ModerationService.resolve_report(
        session,
        report_id=report.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="delete"),
    )
    await session.refresh(note)
    assert note.deleted_at is not None

    # Writing a new note on the same node reactivates the row so it is no longer hidden.
    await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="fresh note"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )

    await session.refresh(note)
    assert note.deleted_at is None
    assert note.deleted_by_id is None
    assert note.content == "fresh note"

    visible = await WarFightNoteService.get_note_for_node(
        session, war_id=war.id, battlegroup=BG, node_number=NODE
    )
    assert visible is not None
    assert visible.id == note.id


@pytest.mark.asyncio
async def test_upsert_identical_content_rejected(session):
    data = await _setup_note_and_reporter(session)
    war = data["war"]
    owner = data["owner"]

    # The note created by the helper already has content "n".
    with pytest.raises(HTTPException) as exc:
        await WarFightNoteService.upsert_note(
            session,
            war=war,
            battlegroup=BG,
            node_number=NODE,
            body=WarFightNoteUpsertRequest(content="n"),
            editor_account_id=owner.id,
            editor_user_id=owner.user_id,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_list_reports_exposes_note_deleted(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    report = await _push_pending_report(session, note.id, data["reporter"])
    admin = await _push_admin(session)

    before = await ModerationService.list_reports(session)
    assert all(item.note_deleted is False for item in before.items)

    await ModerationService.resolve_report(
        session,
        report_id=report.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="delete"),
    )

    after = await ModerationService.list_reports(session)
    target = next(item for item in after.items if item.note_id == note.id)
    assert target.note_deleted is True


@pytest.mark.asyncio
async def test_get_revisions_orders_deletion_above_edits(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    owner = data["owner"]
    war = data["war"]

    # A second edit (the helper already created revision #1).
    await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="v2"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )
    report = await _push_pending_report(session, note.id, data["reporter"])
    admin = await _push_admin(session)
    await ModerationService.resolve_report(
        session,
        report_id=report.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="delete"),
    )

    revs = await ModerationService.get_revisions(session, note.id)
    # Most recent event (the deletion) comes first; edits follow.
    assert revs[0].is_deletion is True
    assert any(not r.is_deletion for r in revs)
    # edited_at is sorted descending.
    assert [r.edited_at for r in revs] == sorted((r.edited_at for r in revs), reverse=True)


@pytest.mark.asyncio
async def test_muted_user_cannot_edit_or_report(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]
    war = data["war"]
    admin = await _push_admin(session)

    await ModerationService.mute_user(
        session,
        user_id=reporter.user_id,
        admin_user_id=admin.id,
        body=MuteCreateRequest(reason="spam"),
    )

    with pytest.raises(HTTPException) as edit_exc:
        await WarFightNoteService.upsert_note(
            session,
            war=war,
            battlegroup=BG,
            node_number=NODE,
            body=WarFightNoteUpsertRequest(content="x"),
            editor_account_id=reporter.id,
            editor_user_id=reporter.user_id,
        )
    assert edit_exc.value.status_code == 403

    with pytest.raises(HTTPException) as report_exc:
        await ModerationService.report_note(
            session,
            note_id=note.id,
            reporter_account_id=reporter.id,
            reporter_user_id=reporter.user_id,
            body=NoteReportCreateRequest(reason="bad"),
        )
    assert report_exc.value.status_code == 403


@pytest.mark.asyncio
async def test_dismiss_then_edit_allows_rereport(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]
    owner = data["owner"]
    war = data["war"]
    report = await _push_pending_report(session, note.id, reporter)
    admin = await _push_admin(session)

    await ModerationService.resolve_report(
        session,
        report_id=report.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="dismiss"),
    )

    # Whitelisted: cannot report until the note is edited.
    with pytest.raises(HTTPException) as exc:
        await _push_pending_report(session, note.id, reporter)
    assert exc.value.status_code == 409

    await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="reworded"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )

    # Editing cleared the whitelist: reporting is allowed again.
    new_report = await _push_pending_report(session, note.id, reporter)
    assert new_report.status == NoteReportStatus.pending


@pytest.mark.asyncio
async def test_delete_same_node_twice_across_reactivation(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    reporter = data["reporter"]
    owner = data["owner"]
    war = data["war"]
    admin = await _push_admin(session)

    r1 = await _push_pending_report(session, note.id, reporter)
    await ModerationService.resolve_report(
        session,
        report_id=r1.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="delete"),
    )

    # Editing reactivates the note (clears deleted_at).
    await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="again"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )

    # Same reporter reports again and admin deletes again: must not raise (no unique clash).
    r2 = await _push_pending_report(session, note.id, reporter)
    await ModerationService.resolve_report(
        session,
        report_id=r2.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="delete"),
    )

    await session.refresh(note)
    assert note.deleted_at is not None


@pytest.mark.asyncio
async def test_resolve_dismiss_whitelists_note(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    report = await _push_pending_report(session, note.id, data["reporter"])
    admin = await _push_admin(session)

    await ModerationService.resolve_report(
        session,
        report_id=report.id,
        admin_user_id=admin.id,
        body=ReportResolveRequest(action="dismiss"),
    )

    await session.refresh(note)
    await session.refresh(report)
    assert note.whitelisted_at is not None
    assert report.status == NoteReportStatus.dismissed


@pytest.mark.asyncio
async def test_mute_then_lift(session):
    data = await _setup_note_and_reporter(session)
    target = data["reporter"]
    admin = await _push_admin(session)

    await ModerationService.mute_user(
        session,
        user_id=target.user_id,
        admin_user_id=admin.id,
        body=MuteCreateRequest(reason="spam"),
    )
    assert await ModerationService.is_user_muted(session, target.user_id) is True

    await ModerationService.lift_mute(
        session,
        user_id=target.user_id,
        admin_user_id=admin.id,
    )
    assert await ModerationService.is_user_muted(session, target.user_id) is False


@pytest.mark.asyncio
async def test_warn_user(session):
    data = await _setup_note_and_reporter(session)
    target = data["reporter"]
    admin = await _push_admin(session)

    await ModerationService.warn_user(
        session,
        user_id=target.user_id,
        admin_user_id=admin.id,
        body=WarnCreateRequest(reason="be nice"),
    )

    warns = (await session.exec(select(UserWarn).where(UserWarn.user_id == target.user_id))).all()
    assert len(warns) == 1
    assert warns[0].reason == "be nice"


@pytest.mark.asyncio
async def test_report_endpoint_and_admin_flow(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    admin = await _push_admin(session)

    member_headers = create_auth_headers(user_id=str(USER2_ID))
    admin_headers = create_auth_headers(user_id=str(admin.id), role=Roles.ADMIN)

    reported = await execute_post_request(
        f"/notes/{note.id}/report", payload={"reason": "bad"}, headers=member_headers
    )
    assert reported.status_code == 201

    listed = await execute_get_request("/admin/note-reports?status=pending", headers=admin_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1
    report_id = listed.json()["items"][0]["id"]

    forbidden = await execute_get_request("/admin/note-reports", headers=member_headers)
    assert forbidden.status_code in (401, 403)

    resolved = await execute_post_request(
        f"/admin/note-reports/{report_id}/resolve",
        payload={"action": "delete"},
        headers=admin_headers,
    )
    assert resolved.status_code == 200


@pytest.mark.asyncio
async def test_get_revisions_exposes_editor_user_id(session):
    data = await _setup_note_and_reporter(session)
    note = data["note"]
    owner = data["owner"]
    admin = await _push_admin(session)
    admin_headers = create_auth_headers(user_id=str(admin.id), role=Roles.ADMIN)

    res = await execute_get_request(f"/admin/notes/{note.id}/revisions", headers=admin_headers)
    assert res.status_code == 200
    revisions = res.json()
    assert len(revisions) == 1
    assert revisions[0]["edited_by_user_id"] == str(owner.user_id)
    assert revisions[0]["edited_by_pseudo"] is not None


@pytest.mark.asyncio
async def test_admin_mute_and_warn_endpoints(session):
    data = await _setup_note_and_reporter(session)
    target_user_id = data["reporter"].user_id
    admin = await _push_admin(session)
    admin_headers = create_auth_headers(user_id=str(admin.id), role=Roles.ADMIN)

    muted = await execute_post_request(
        f"/admin/users/{target_user_id}/mute",
        payload={"reason": "stop spamming"},
        headers=admin_headers,
    )
    assert muted.status_code == 200

    warned = await execute_post_request(
        f"/admin/users/{target_user_id}/warn",
        payload={"reason": "be nice"},
        headers=admin_headers,
    )
    assert warned.status_code == 200

    mutes = await execute_get_request("/admin/mutes", headers=admin_headers)
    assert mutes.status_code == 200
    target_mute = next(m for m in mutes.json() if m["user_id"] == str(target_user_id))
    assert target_mute["muted_by_login"] == admin.login

    warns = await execute_get_request(
        f"/admin/warns?user_id={target_user_id}", headers=admin_headers
    )
    assert warns.status_code == 200
    target_warn = next(w for w in warns.json() if w["reason"] == "be nice")
    assert target_warn["warned_by_login"] == admin.login

    lifted = await execute_delete_request(
        f"/admin/users/{target_user_id}/mute", headers=admin_headers
    )
    assert lifted.status_code == 200
    assert await ModerationService.is_user_muted(session, target_user_id) is False


@pytest.mark.asyncio
async def test_three_reports_block_note_in_war_map(session):
    from src.services.alliance.war.WarService import WarService

    data = await _setup_war_with_placement()
    alliance = data["alliance"]
    owner = data["owner"]
    war = data["war"]

    note = await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="secret note"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )

    for i in range(3):
        reporter_user = User(
            id=uuid.uuid4(),
            login=f"reporter{i}",
            email_hash=f"reporter{i}_hash",
            discord_id=70000 + i,
            role=Roles.USER,
        )
        session.add(reporter_user)
        await session.commit()
        member = await push_member(alliance, user_id=reporter_user.id, game_pseudo=f"Reporter{i}")
        await ModerationService.report_note(
            session,
            note_id=note.id,
            reporter_account_id=member.id,
            reporter_user_id=reporter_user.id,
            body=NoteReportCreateRequest(),
        )

    summary = await WarService.get_war_defense(session, war.id, BG)
    node = next(p for p in summary.placements if p.node_number == NODE)
    assert node.note_blocked is True
    assert node.note is None


@pytest.mark.asyncio
async def test_note_id_present_in_war_map(session):
    from src.services.alliance.war.WarService import WarService

    data = await _setup_war_with_placement()
    owner = data["owner"]
    war = data["war"]
    note = await WarFightNoteService.upsert_note(
        session,
        war=war,
        battlegroup=BG,
        node_number=NODE,
        body=WarFightNoteUpsertRequest(content="visible"),
        editor_account_id=owner.id,
        editor_user_id=owner.user_id,
    )

    summary = await WarService.get_war_defense(session, war.id, BG)
    node = next(p for p in summary.placements if p.node_number == NODE)
    assert node.note_id == note.id
    assert node.note == "visible"


@pytest.mark.asyncio
async def test_me_moderation_reports_mute_and_warns(session):
    data = await _setup_note_and_reporter(session)
    target_user_id = data["reporter"].user_id
    admin = await _push_admin(session)
    admin_headers = create_auth_headers(user_id=str(admin.id), role=Roles.ADMIN)

    await execute_post_request(
        f"/admin/users/{target_user_id}/mute",
        payload={"reason": "stop"},
        headers=admin_headers,
    )
    await execute_post_request(
        f"/admin/users/{target_user_id}/warn",
        payload={"reason": "warned"},
        headers=admin_headers,
    )

    member_headers = create_auth_headers(user_id=str(target_user_id))
    me = await execute_get_request("/me/moderation", headers=member_headers)
    assert me.status_code == 200
    body = me.json()
    assert body["mute"]["reason"] == "stop"
    assert any(w["reason"] == "warned" for w in body["warns"])
