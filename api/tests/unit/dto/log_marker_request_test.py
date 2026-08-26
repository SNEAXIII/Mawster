"""Unit tests for the /dev/log-marker request validator."""

from src.controllers.dev_controller import MAX_LOG_TITLE, LogMarkerRequest


def test_title_keeps_a_plain_title_intact():
    body = LogMarkerRequest(event="start", title="war > place defender > node 1")

    assert body.title == "war > place defender > node 1"


def test_title_collapses_a_newline_that_would_forge_a_marker():
    forged = "ok\n2026-08-26 INFO ===TEST_START=== someone else's test"

    body = LogMarkerRequest(event="start", title=forged)

    assert "\n" not in body.title
    assert body.title == "ok 2026-08-26 INFO ===TEST_START=== someone else's test"


def test_title_collapses_carriage_returns_and_tabs():
    body = LogMarkerRequest(event="end", title="a\r\nb\tc", passed=True)

    assert body.title == "a b c"


def test_title_is_capped():
    body = LogMarkerRequest(event="start", title="x" * (MAX_LOG_TITLE + 50))

    assert len(body.title) == MAX_LOG_TITLE
