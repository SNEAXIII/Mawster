"""Integration tests for the Admin Audit Entries written around admin endpoints."""

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.routing import iter_route_contexts
from sqlmodel import select
from starlette.requests import ClientDisconnect, Request

from main import app
from src.enums.Roles import Roles
from src.models.user.AdminAuditEntry import AdminAuditEntry
from src.services.admin.AdminAuditService import AdminAuditService
from src.services.admin.ChampionService import ChampionService
from src.utils.audited_route import AuditedRoute
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_champion
from tests.integration.endpoints.setup.user_setup import (
    STANDALONE_ADMIN_HEADERS,
    STANDALONE_ADMIN_ID,
    push_one_user,
    push_standalone_admin,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    get_test_client,
)
from tests.utils.utils_constant import USER_ID
from tests.utils.utils_db import Session, get_test_session

MUTE_URL = f"/admin/users/{USER_ID}/mute"
MUTE_ROUTE = "/admin/users/{user_id}/mute"
ALIAS_ROUTE = "/admin/champions/{champion_id}/alias"
LOGINS_URL = "/admin/logins/stats"
NESTED_40 = b"[" * 40 + b"]" * 40
GRIN = "\U0001f600"


@pytest.fixture(autouse=True)
async def _users_in_db():
    await push_one_user()
    await push_standalone_admin()


async def _entries(session) -> list[AdminAuditEntry]:
    return list((await session.exec(select(AdminAuditEntry))).all())


async def _post_raw(url: str, body: bytes, content_type: str = "application/json"):
    headers = {**STANDALONE_ADMIN_HEADERS, "Content-Type": content_type}
    async with get_test_client() as client:
        return await client.post(url, content=body, headers=headers)


def _depth(value: object) -> int:
    if isinstance(value, dict):
        return 1 + max(map(_depth, value.values()), default=0)
    if isinstance(value, list):
        return 1 + max(map(_depth, value), default=0)
    return 0


async def _only_entry(session) -> AdminAuditEntry:
    entries = await _entries(session)
    assert len(entries) == 1
    return entries[0]


async def test_mutation_stores_details_without_reason(session):
    response = await execute_post_request(
        f"{MUTE_URL}?notify=no", {"reason": "secret"}, headers=STANDALONE_ADMIN_HEADERS
    )

    assert response.status_code == 200
    entry = await _only_entry(session)
    assert entry.user_id == STANDALONE_ADMIN_ID
    assert entry.role == Roles.ADMIN
    assert (entry.method, entry.route, entry.status_code) == ("POST", MUTE_ROUTE, 200)
    assert entry.details == {
        "path": {"user_id": str(USER_ID)},
        "query": {"notify": "no"},
        "body": {"expires_at": None},
        "response_id": response.json()["id"],
    }


async def test_champion_load_stores_only_the_count(session):
    payload = [
        {"name": f"Champion {i}", "champion_class": "Tech", "image_url": "a.png"} for i in range(3)
    ]

    response = await execute_post_request(
        "/admin/champions/load", payload, headers=STANDALONE_ADMIN_HEADERS
    )

    assert response.status_code == 200
    details = (await _only_entry(session)).details
    assert details["body"] == {"count": 3}
    assert "body_raw" not in details


async def test_champion_load_item_outside_the_dto_is_kept_as_text(session):
    payload = [
        {"name": "Clean", "champion_class": "Tech"},
        {"name": "Forged", "champion_class": "Tech", "z": "payload"},
    ]

    response = await execute_post_request(
        "/admin/champions/load", payload, headers=STANDALONE_ADMIN_HEADERS
    )

    assert response.status_code == 200
    details = (await _only_entry(session)).details
    assert details["body"] == {"count": 2}
    assert '"z": "payload"' in details["body_raw"]
    assert _depth(details) <= 2


async def test_oversized_details_are_replaced(session):
    response = await execute_post_request(
        f"{MUTE_URL}?padding={'x' * 9000}", {"reason": "spam"}, headers=STANDALONE_ADMIN_HEADERS
    )

    assert response.status_code == 200
    assert (await _only_entry(session)).details == {"truncated": True}


async def test_oversized_details_keep_the_payload(session):
    response = await _post_raw(
        f"{MUTE_URL}?padding={'x' * 9000}", b'{"reason": "x", "z": "payload"}'
    )

    assert response.status_code == 200
    assert (await _only_entry(session)).details == {
        "truncated": True,
        "body_raw": '{"z": "payload"}',
    }


async def test_body_keeps_declared_fields_only(session):
    payload = {"reason": "spam", "expires_at": "2099-01-01T00:00:00Z", "z": 1}

    response = await execute_post_request(MUTE_URL, payload, headers=STANDALONE_ADMIN_HEADERS)

    assert response.status_code == 200
    details = (await _only_entry(session)).details
    assert details["body"] == {"expires_at": "2099-01-01T00:00:00Z"}
    assert details["body_raw"] == '{"expires_at": "2099-01-01T00:00:00Z", "z": 1}'


async def test_long_body_raw_is_cut(session):
    payload = {"reason": "spam", "z": "x" * 5000}

    response = await execute_post_request(MUTE_URL, payload, headers=STANDALONE_ADMIN_HEADERS)

    assert response.status_code == 200
    assert len((await _only_entry(session)).details["body_raw"]) == 2048


async def test_list_on_a_route_expecting_an_object(session):
    response = await execute_post_request(MUTE_URL, [1, 2], headers=STANDALONE_ADMIN_HEADERS)

    assert response.status_code == 422
    details = (await _only_entry(session)).details
    assert details["body"] == {"count": 2}
    assert details["body_raw"] == "[1, 2]"


@pytest.mark.parametrize(
    ("raw_value", "kept"),
    [(rb'"\ud800"', r"\ud800"), (b"NaN", "NaN"), (NESTED_40, "[[[[")],
    ids=["surrogate", "nan", "nested"],
)
async def test_hostile_unknown_field_is_kept_as_text(session, raw_value, kept):
    response = await _post_raw(MUTE_URL, b'{"reason": "x", "z": ' + raw_value + b"}")

    assert response.status_code == 200
    entry = await _only_entry(session)
    assert (entry.route, entry.status_code) == (MUTE_ROUTE, 200)
    assert entry.details["body"] == {"expires_at": None}
    assert isinstance(entry.details["body_raw"], str)
    assert '"z": ' in entry.details["body_raw"]
    assert kept in entry.details["body_raw"]
    assert "reason" not in entry.details["body_raw"]
    assert _depth(entry.details) <= 2


async def test_nested_declared_field_is_a_422_entry_without_body(session):
    champion = await push_champion()

    async with get_test_client() as client:
        response = await client.patch(
            f"/admin/champions/{champion.id}/alias",
            content=b'{"alias": ' + NESTED_40 + b"}",
            headers={**STANDALONE_ADMIN_HEADERS, "Content-Type": "application/json"},
        )

    assert response.status_code == 422
    entry = await _only_entry(session)
    assert entry.status_code == 422
    assert entry.details["path"] == {"champion_id": str(champion.id)}
    assert "body" not in entry.details
    assert entry.details["body_raw"].startswith('{"alias": [[[[')
    assert _depth(entry.details) <= 2


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        (b"not json", "not json"),
        (b"caf\xc3\xa9 \xff", "café \ufffd"),
        (b'{"a":' * 200_000, '{"a":' * 409 + '{"a'),
        (b"[" * 200_000, "[" * 2048),
        (("x" + GRIN * 2048).encode(), "x" + GRIN * 511),
    ],
    ids=["text", "bad-utf8", "deep-object", "deep-list", "four-byte"],
)
async def test_unparsable_body_is_decoded(session, body, expected):
    response = await _post_raw(MUTE_URL, body, content_type="text/plain")

    assert response.status_code == 422
    entry = await _only_entry(session)
    assert entry.status_code == 422
    assert "body" not in entry.details
    assert entry.details["body_raw"] == expected


async def test_empty_body_stores_nothing_of_it(session):
    response = await _post_raw(MUTE_URL, b"")

    assert response.status_code == 422
    assert (await _only_entry(session)).details == {"path": {"user_id": str(USER_ID)}, "query": {}}


async def test_body_on_a_route_without_body_model_is_raw_only(session):
    lifted = await _delete_mute_with_a_body()

    assert lifted.status_code == 200
    details = (await _only_entry(session)).details
    assert "body" not in details
    assert details["body_raw"] == '{"z": 1}'


async def _delete_mute_with_a_body():
    async with get_test_client() as client:
        return await client.request(
            "DELETE", MUTE_URL, content=b'{"z": 1}', headers=STANDALONE_ADMIN_HEADERS
        )


async def test_body_of_a_disconnected_client_is_left_out(session, mocker):
    mocker.patch.object(Request, "body", side_effect=ClientDisconnect)

    response = await _delete_mute_with_a_body()

    assert response.status_code == 200
    assert (await _only_entry(session)).details == {"path": {"user_id": str(USER_ID)}, "query": {}}


async def test_body_never_sent_is_left_out_and_does_not_hold_the_response(session, mocker):
    async def stalled_read(_request):
        await asyncio.Event().wait()

    mocker.patch.object(Request, "body", stalled_read)
    mocker.patch("src.services.admin.AdminAuditService.BODY_READ_TIMEOUT_SECONDS", 0.01)

    response = await _delete_mute_with_a_body()

    assert response.status_code == 200
    assert (await _only_entry(session)).details == {"path": {"user_id": str(USER_ID)}, "query": {}}


async def test_unserializable_details_are_replaced():
    body_field = MagicMock()
    body_field.validate.return_value = ("validated", [])
    body_field.serialize.return_value = {"alias": "\ud800"}
    request = MagicMock(body=AsyncMock(return_value=b"{}"), path_params={}, query_params={})
    request.state = SimpleNamespace(audit_is_admin=True)

    details = await AdminAuditService._details(
        request, SimpleNamespace(body_field=body_field), None
    )

    assert details == {"truncated": True}


async def test_anonymous_call_has_no_author_and_no_details(session):
    response = await execute_post_request(f"{MUTE_URL}?x=1", {"reason": "spam"})

    assert response.status_code == 401
    entry = await _only_entry(session)
    assert entry.user_id is None
    assert entry.role is None
    assert entry.status_code == 401
    assert entry.details is None


@pytest.mark.parametrize("claimed_role", [Roles.USER, Roles.ADMIN])
async def test_plain_account_is_author_without_details(session, claimed_role):
    headers = create_auth_headers(role=claimed_role)

    response = await execute_post_request(MUTE_URL, {"reason": "spam"}, headers=headers)

    assert response.status_code == 403
    entry = await _only_entry(session)
    assert entry.user_id == USER_ID
    assert entry.role == Roles.USER
    assert entry.details is None


async def test_not_found_by_an_admin(session):
    champion_id = uuid.uuid4()

    response = await execute_patch_request(
        f"/admin/champions/{champion_id}/alias",
        {"alias": "x"},
        headers=STANDALONE_ADMIN_HEADERS,
    )

    assert response.status_code == 404
    entry = await _only_entry(session)
    assert (entry.route, entry.status_code) == (ALIAS_ROUTE, 404)
    assert entry.details["path"] == {"champion_id": str(champion_id)}


async def test_validation_error_by_an_admin(session):
    payload = {"reason": "secret", "expires_at": "nope"}

    response = await execute_post_request(MUTE_URL, payload, headers=STANDALONE_ADMIN_HEADERS)

    assert response.status_code == 422
    entry = await _only_entry(session)
    assert entry.status_code == 422
    assert entry.user_id == STANDALONE_ADMIN_ID
    assert entry.details == {
        "path": {"user_id": str(USER_ID)},
        "query": {},
        "body_raw": '{"expires_at": "nope"}',
    }


async def test_successful_get_writes_nothing(session):
    response = await execute_get_request(LOGINS_URL, headers=STANDALONE_ADMIN_HEADERS)

    assert response.status_code == 200
    assert await _entries(session) == []


async def test_refused_get_writes_one_entry(session):
    response = await execute_get_request(LOGINS_URL, headers=create_auth_headers())

    assert response.status_code == 403
    entry = await _only_entry(session)
    assert (entry.method, entry.route, entry.status_code) == ("GET", LOGINS_URL, 403)


async def test_crash_after_rollback_is_recorded_with_its_author(session, mocker):
    async def crash(action_session, *_args):
        await action_session.rollback()
        raise RuntimeError

    mocker.patch.object(ChampionService, "update_alias", side_effect=crash)
    champion = await push_champion()

    response = await execute_patch_request(
        f"/admin/champions/{champion.id}/alias",
        {"alias": "x"},
        headers=STANDALONE_ADMIN_HEADERS,
    )

    assert response.status_code == 500
    entry = await _only_entry(session)
    assert entry.status_code == 500
    assert entry.user_id == STANDALONE_ADMIN_ID


async def test_failed_audit_write_leaves_the_response_unchanged(session, mocker):
    mocker.patch("src.services.admin.AdminAuditService.AdminAuditEntry", side_effect=RuntimeError)

    response = await execute_post_request(
        MUTE_URL, {"reason": "spam"}, headers=STANDALONE_ADMIN_HEADERS
    )

    assert response.status_code == 200
    assert response.json()["reason"] == "spam"
    assert await _entries(session) == []


async def test_failed_audit_commit_leaves_the_response_unchanged(session, mocker):
    opened = 0

    async def provider():
        nonlocal opened
        opened += 1
        async with Session() as provided:
            if opened == 2:  # The action resolves its session once, the audit opens the second.
                provided.commit = AsyncMock(side_effect=RuntimeError)
            yield provided

    mocker.patch.dict(app.dependency_overrides, {get_session: provider})

    response = await execute_post_request(
        MUTE_URL, {"reason": "spam"}, headers=STANDALONE_ADMIN_HEADERS
    )

    assert opened == 2
    assert response.status_code == 200
    assert response.json()["reason"] == "spam"
    assert await _entries(session) == []


async def test_audit_write_defaults_to_its_own_provider(session, mocker):
    mocker.patch("src.services.admin.AdminAuditService.get_audit_session", get_test_session)
    request = SimpleNamespace(
        method="POST", state=SimpleNamespace(), app=SimpleNamespace(dependency_overrides={})
    )

    await AdminAuditService.record(request, SimpleNamespace(path="/admin/x"), 500)

    assert (await _only_entry(session)).route == "/admin/x"


def test_every_admin_route_is_audited():
    # app.routes holds one opaque entry per included router, not the routes themselves.
    contexts = iter_route_contexts(app.routes)
    admin_routes = [context for context in contexts if (context.path or "").startswith("/admin")]

    assert admin_routes
    for context in admin_routes:
        assert isinstance(context.original_route, AuditedRoute), context.path
        # The recorder stores route.path: an include-time prefix would be missing from it.
        assert context.original_route.path == context.path
