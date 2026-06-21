"""Server-side sanitization of user-provided moderation/note free text."""

import pytest
from pydantic import ValidationError

from src.dto.admin.dto_moderation import (
    MuteCreateRequest,
    NoteReportCreateRequest,
    WarnCreateRequest,
)
from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
from src.utils.sanitize import sanitize_text


def test_sanitize_text_strips_tags_keeps_text():
    assert sanitize_text("<b>hi</b>") == "hi"
    assert sanitize_text("  spaced  ") == "spaced"
    assert "<script>" not in sanitize_text("<script>alert(1)</script>watch bleed")


def test_sanitize_text_preserves_ampersand():
    assert sanitize_text("Cap & Thor") == "Cap & Thor"


def test_note_content_is_sanitized():
    req = WarFightNoteUpsertRequest(content="<b>danger</b> on node")
    assert req.content == "danger on node"


def test_note_content_with_tag_attributes_is_neutralized():
    req = WarFightNoteUpsertRequest(content='<a href="javascript:alert(1)">click</a>')
    assert "<a" not in req.content
    assert "javascript:" not in req.content or "<" not in req.content
    assert "click" in req.content


def test_note_content_that_is_only_markup_is_rejected():
    with pytest.raises(ValidationError):
        WarFightNoteUpsertRequest(content="<img src=x onerror=alert(1)>")


def test_mute_reason_is_sanitized():
    req = MuteCreateRequest(reason="<b>spam</b>")
    assert req.reason == "spam"


def test_warn_reason_is_sanitized():
    req = WarnCreateRequest(reason="<i>be nice</i>")
    assert req.reason == "be nice"


def test_report_reason_optional_markup_becomes_none():
    req = NoteReportCreateRequest(reason="<br>")
    assert req.reason is None
    assert NoteReportCreateRequest(reason=None).reason is None
