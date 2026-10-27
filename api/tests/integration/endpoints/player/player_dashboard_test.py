"""Integration tests for GET /me/dashboard."""

import uuid
from datetime import UTC, datetime

import pytest

from main import app
from src.enums.InvitationType import InvitationType
from src.enums.Roles import Roles
from src.models.alliance.AllianceInvitation import AllianceInvitation
from src.models.champion.RequestedUpgrade import RequestedUpgrade
from src.models.war.War import War
from src.models.war.WarReadyBattlegroup import WarReadyBattlegroup
from src.utils.db import get_session
from tests.integration.endpoints.setup.defense_setup import (
    push_plan,
    push_plan_node,
    setup_defense_bg,
)
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
    push_game_account,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
USER2_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)


def _url(game_account_id: uuid.UUID) -> str:
    return f"/me/dashboard?game_account_id={game_account_id}"


@pytest.mark.anyio
async def test_another_accounts_player_is_not_found():
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()
    player = await push_game_account(user_id=USER_ID)

    resp = await execute_get_request(_url(player.id), USER2_HEADERS)

    assert resp.status_code == 404


@pytest.mark.anyio
async def test_deleted_player_is_not_found():
    await load_objects([get_generic_user(is_base_id=True)])
    player = await push_game_account(user_id=USER_ID, deleted_at=datetime.now(UTC))

    resp = await execute_get_request(_url(player.id), USER_HEADERS)

    assert resp.status_code == 404


@pytest.mark.anyio
async def test_player_without_alliance_sees_only_own_invitations_and_upgrades():
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()
    alliance, inviter = await push_alliance_with_owner(user_id=USER2_ID, game_pseudo="Inviter")
    player = await push_game_account(user_id=USER_ID, game_pseudo="Solo")
    sibling = await push_game_account(user_id=USER_ID, game_pseudo="Sibling")
    copy = await push_champion_user(player, await push_champion())
    await load_objects(
        [
            AllianceInvitation(
                alliance_id=alliance.id,
                game_account_id=player.id,
                invited_by_game_account_id=inviter.id,
                type=InvitationType.VISITOR,
            ),
            AllianceInvitation(
                alliance_id=alliance.id,
                game_account_id=sibling.id,
                invited_by_game_account_id=inviter.id,
            ),
            RequestedUpgrade(
                champion_user_id=copy.id,
                requester_game_account_id=inviter.id,
                requested_stars=7,
                requested_rank=3,
            ),
        ]
    )

    resp = await execute_get_request(_url(player.id), USER_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert [i["game_account_id"] for i in body["invitations"]] == [str(player.id)]
    assert [u["champion_user_id"] for u in body["upgrade_requests"]] == [str(copy.id)]
    assert body["alliance"] is None
    assert body["war"] is None
    assert body["defense"] == []


@pytest.mark.anyio
async def test_player_in_alliance_sees_ready_war_and_own_active_defense():
    bg = await setup_defense_bg()
    active = await push_plan(bg.alliance.id, active=True)
    await push_plan_node(active, 1, champion_user=bg.owner_spider)
    await push_plan_node(active, 2, champion_user=bg.member_iron_man)
    inactive = await push_plan(bg.alliance.id, name="Draft")
    await push_plan_node(inactive, 3, champion_user=bg.owner_wolverine)
    war = War(alliance_id=bg.alliance.id, opponent_name="Enemy", created_by_id=bg.owner.id)
    await load_objects([war, WarReadyBattlegroup(war_id=war.id, battlegroup=1)])

    resp = await execute_get_request(_url(bg.owner.id), USER_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert body["alliance"]["alliance_id"] == str(bg.alliance.id)
    assert body["alliance"]["battlegroup"] == 1
    assert [n["node_number"] for n in body["defense"]] == [1]
    assert body["war"] == {
        "opponent_name": "Enemy",
        "battlegroup": 1,
        "is_ready": True,
    }
