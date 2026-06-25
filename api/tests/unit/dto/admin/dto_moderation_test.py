"""Unit tests for the moderation DTO fields added with the deletion-history feature."""

import uuid
from datetime import datetime

from src.dto.admin.dto_moderation import (
    MuteResponse,
    NoteReportResponse,
    NoteRevisionResponse,
    WarnResponse,
)
from src.enums.NoteReportStatus import NoteReportStatus


def test_note_revision_response_defaults():
    rev = NoteRevisionResponse(id=uuid.uuid4(), content="hi", edited_at=datetime.now())
    assert rev.is_deletion is False
    assert rev.edited_by_user_id is None
    assert rev.edited_by_pseudo is None


def test_note_revision_response_deletion_entry():
    rev = NoteRevisionResponse(
        id=uuid.uuid4(),
        content="snapshot",
        edited_by_pseudo="modadmin",
        is_deletion=True,
        edited_at=datetime.now(),
    )
    assert rev.is_deletion is True
    assert rev.edited_by_pseudo == "modadmin"
    # Deletion entries carry no contributor to mute/warn.
    assert rev.edited_by_user_id is None


def test_mute_response_admin_login_default_none():
    mute = MuteResponse(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        reason="spam",
        created_at=datetime.now(),
    )
    assert mute.muted_by_login is None


def test_warn_response_admin_login_default_none():
    warn = WarnResponse(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        reason="be nice",
        created_at=datetime.now(),
    )
    assert warn.warned_by_login is None


def test_note_report_response_note_deleted_default_false():
    report = NoteReportResponse(
        id=uuid.uuid4(),
        note_id=uuid.uuid4(),
        alliance_id=uuid.uuid4(),
        battlegroup=1,
        node_number=5,
        note_content="content",
        status=NoteReportStatus.pending,
        created_at=datetime.now(),
    )
    assert report.note_deleted is False


def test_note_report_status_has_no_stale():
    assert not hasattr(NoteReportStatus, "stale")
    assert {s.value for s in NoteReportStatus} == {"pending", "resolved", "dismissed"}
