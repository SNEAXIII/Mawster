"""Integration tests for the matchup rating endpoints."""

import uuid

import pytest

from main import app
from src.enums.MatchupTargetType import MatchupTargetType
from src.enums.MatchupVerdict import MatchupVerdict
from src.models.DefensePlacement import DefensePlacement
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
    push_member,
    push_officer,
    push_visitor,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_post_request,
)
from tests.utils.utils_constant import USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_OWNER = create_auth_headers(user_id=str(USER_ID))


async def _setup_alliance_with_champions():
    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner = await push_alliance_with_owner()
    attacker = await push_champion(name="Doctor Doom", champion_class="Mystic")
    defender = await push_champion(name="Korg", champion_class="Cosmic")
    return alliance, owner, attacker, defender


@pytest.mark.asyncio
async def test_upsert_writes_one_row_per_target():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    payload = {
        "champion_id": str(attacker.id),
        "targets": [
            {
                "target_type": MatchupTargetType.DEFENDER.value,
                "defender_champion_id": str(defender.id),
                "verdict": MatchupVerdict.OK.value,
            },
            {
                "target_type": MatchupTargetType.NODE.value,
                "node_number": 1,
                "verdict": MatchupVerdict.GOOD.value,
            },
        ],
    }
    response = await execute_post_request(
        f"/alliances/{alliance.id}/matchups", payload, HEADERS_OWNER
    )
    assert response.status_code == 201
    assert len(response.json()) == 2

    listing = await execute_get_request(f"/alliances/{alliance.id}/matchups", HEADERS_OWNER)
    assert len(listing.json()) == 2


@pytest.mark.asyncio
async def test_upsert_overwrites_the_same_target_instead_of_duplicating():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    route = f"/alliances/{alliance.id}/matchups"
    target = {
        "target_type": MatchupTargetType.DEFENDER.value,
        "defender_champion_id": str(defender.id),
    }

    await execute_post_request(
        route,
        {"champion_id": str(attacker.id), "targets": [{**target, "verdict": "ok"}]},
        HEADERS_OWNER,
    )
    await execute_post_request(
        route,
        {"champion_id": str(attacker.id), "targets": [{**target, "verdict": "discouraged"}]},
        HEADERS_OWNER,
    )

    listing = await execute_get_request(route, HEADERS_OWNER)
    body = listing.json()
    assert len(body) == 1
    assert body[0]["verdict"] == "discouraged"


@pytest.mark.asyncio
async def test_upsert_rejects_three_synergies():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    payload = {
        "champion_id": str(attacker.id),
        "targets": [
            {
                "target_type": MatchupTargetType.DEFENDER.value,
                "defender_champion_id": str(defender.id),
                "verdict": "good",
                "synergies": [{"champion_id": str(uuid.uuid4())} for _ in range(3)],
            }
        ],
    }
    response = await execute_post_request(
        f"/alliances/{alliance.id}/matchups", payload, HEADERS_OWNER
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_evaluation_sums_both_verdicts_and_sorts_best_first():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    weak = await push_champion(name="Kamala Khan", champion_class="Cosmic")
    route = f"/alliances/{alliance.id}/matchups"

    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                },
                {"target_type": "node", "node_number": 23, "verdict": "good"},
            ],
        },
        HEADERS_OWNER,
    )
    await execute_post_request(
        route,
        {
            "champion_id": str(weak.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "ok",
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&node_number=23", HEADERS_OWNER
    )
    rows = response.json()
    assert [row["champion"]["champion_name"] for row in rows] == ["Doctor Doom", "Kamala Khan"]
    assert rows[0]["score"] == 4
    assert rows[1]["score"] == 1


@pytest.mark.asyncio
async def test_evaluation_reports_discouraged_without_a_score_and_sorts_it_last():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    good = await push_champion(name="Hercules", champion_class="Cosmic")
    route = f"/alliances/{alliance.id}/matchups"

    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                },
                {"target_type": "node", "node_number": 23, "verdict": "discouraged"},
            ],
        },
        HEADERS_OWNER,
    )
    await execute_post_request(
        route,
        {
            "champion_id": str(good.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "ok",
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&node_number=23", HEADERS_OWNER
    )
    rows = response.json()
    assert rows[0]["champion"]["champion_name"] == "Hercules"
    assert rows[-1]["champion"]["champion_name"] == "Doctor Doom"
    assert rows[-1]["is_discouraged"] is True
    assert rows[-1]["score"] is None


@pytest.mark.asyncio
async def test_evaluation_marks_unowned_champion_as_not_playable():
    alliance, owner, attacker, defender = await _setup_alliance_with_champions()
    route = f"/alliances/{alliance.id}/matchups"
    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&game_account_id={owner.id}",
        HEADERS_OWNER,
    )
    row = response.json()[0]
    assert row["is_playable"] is False
    assert [c["champion_name"] for c in row["missing_champions"]] == ["Doctor Doom"]
    assert row["instance_label"] is None


@pytest.mark.asyncio
async def test_evaluation_reports_the_owned_instance_label():
    alliance, owner, attacker, defender = await _setup_alliance_with_champions()
    await push_champion_user(owner, attacker, stars=7, rank=5, signature=200, ascension=2)
    route = f"/alliances/{alliance.id}/matchups"
    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&game_account_id={owner.id}",
        HEADERS_OWNER,
    )
    row = response.json()[0]
    assert row["is_playable"] is True
    assert row["instance_label"] == "7r5 a2 sig 200"
    assert row["is_on_defense"] is False


@pytest.mark.asyncio
async def test_evaluation_greys_a_missing_required_synergy_but_not_a_recommended_one():
    alliance, owner, attacker, defender = await _setup_alliance_with_champions()
    await push_champion_user(owner, attacker)
    required = await push_champion(name="Mister Fantastic", champion_class="Science")
    recommended = await push_champion(name="Invisible Woman", champion_class="Science")
    route = f"/alliances/{alliance.id}/matchups"

    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                    "synergies": [
                        {"champion_id": str(required.id), "is_required": True},
                        {"champion_id": str(recommended.id), "is_required": False},
                    ],
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&game_account_id={owner.id}",
        HEADERS_OWNER,
    )
    row = response.json()[0]
    assert row["is_playable"] is False
    assert [c["champion_name"] for c in row["missing_champions"]] == ["Mister Fantastic"]


@pytest.mark.asyncio
async def test_evaluation_warns_when_the_instance_is_placed_on_defense():
    alliance, owner, attacker, defender = await _setup_alliance_with_champions()
    champion_user = await push_champion_user(owner, attacker)
    await load_objects(
        [
            DefensePlacement(
                alliance_id=alliance.id,
                battlegroup=1,
                node_number=5,
                champion_user_id=champion_user.id,
                game_account_id=owner.id,
            )
        ]
    )
    route = f"/alliances/{alliance.id}/matchups"
    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&game_account_id={owner.id}",
        HEADERS_OWNER,
    )
    row = response.json()[0]
    assert row["is_playable"] is True
    assert row["is_on_defense"] is True


@pytest.mark.asyncio
async def test_evaluation_merges_a_synergy_rated_on_both_sides_as_required():
    """The unified form attaches the same synergies to both ratings, so they overlap.

    Merging must key on champion_id and let `required` win over `recommended`, whichever side
    carries which. Concatenating would list the champion twice.
    """
    alliance, owner, attacker, defender = await _setup_alliance_with_champions()
    await push_champion_user(owner, attacker)
    synergy = await push_champion(name="Mister Fantastic", champion_class="Science")
    route = f"/alliances/{alliance.id}/matchups"

    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                    "synergies": [{"champion_id": str(synergy.id), "is_required": False}],
                },
                {
                    "target_type": "node",
                    "node_number": 23,
                    "verdict": "good",
                    "synergies": [{"champion_id": str(synergy.id), "is_required": True}],
                },
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&node_number=23"
        f"&game_account_id={owner.id}",
        HEADERS_OWNER,
    )
    row = response.json()[0]
    assert len(row["synergies"]) == 1
    assert row["synergies"][0]["is_required"] is True
    assert [c["champion_name"] for c in row["missing_champions"]] == ["Mister Fantastic"]


@pytest.mark.asyncio
async def test_evaluation_surfaces_the_strongest_owned_instance():
    """A 6-star and a 7-star of the same champion is an ordinary roster."""
    alliance, owner, attacker, defender = await _setup_alliance_with_champions()
    await push_champion_user(owner, attacker, stars=6, rank=5, signature=0, ascension=0)
    await push_champion_user(owner, attacker, stars=7, rank=3, signature=20, ascension=0)
    route = f"/alliances/{alliance.id}/matchups"
    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&game_account_id={owner.id}",
        HEADERS_OWNER,
    )
    row = response.json()[0]
    assert row["instance_label"] == "7r3 sig 20"


@pytest.mark.asyncio
async def test_evaluation_only_warns_when_the_strongest_instance_is_on_defense():
    """The weaker instance sitting on defense must not warn about the stronger, free one."""
    alliance, owner, attacker, defender = await _setup_alliance_with_champions()
    weak = await push_champion_user(owner, attacker, stars=6, rank=5)
    await push_champion_user(owner, attacker, stars=7, rank=3)
    await load_objects(
        [
            DefensePlacement(
                alliance_id=alliance.id,
                battlegroup=1,
                node_number=5,
                champion_user_id=weak.id,
                game_account_id=owner.id,
            )
        ]
    )
    route = f"/alliances/{alliance.id}/matchups"
    await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                }
            ],
        },
        HEADERS_OWNER,
    )

    response = await execute_get_request(
        f"{route}/evaluation?defender_champion_id={defender.id}&game_account_id={owner.id}",
        HEADERS_OWNER,
    )
    row = response.json()[0]
    assert row["is_on_defense"] is False
    assert row["instance_label"] == "7r3 sig 0"


OUTSIDER_ID = uuid.uuid4()
HEADERS_OUTSIDER = create_auth_headers(user_id=str(OUTSIDER_ID))
VISITOR_ID = uuid.uuid4()
HEADERS_VISITOR = create_auth_headers(user_id=str(VISITOR_ID))
MEMBER_ID = uuid.uuid4()
HEADERS_MEMBER = create_auth_headers(user_id=str(MEMBER_ID))


def _defender_payload(attacker_id, defender_id) -> dict:
    return {
        "champion_id": str(attacker_id),
        "targets": [
            {
                "target_type": "defender",
                "defender_champion_id": str(defender_id),
                "verdict": "good",
            }
        ],
    }


@pytest.mark.asyncio
async def test_outsider_cannot_read_matchups():
    alliance, _owner, _attacker, _defender = await _setup_alliance_with_champions()
    outsider = get_generic_user(login="outsider", email="outsider@test.com")
    outsider.id = OUTSIDER_ID
    outsider.discord_id = "discord_outsider"
    await load_objects([outsider])

    response = await execute_get_request(f"/alliances/{alliance.id}/matchups", HEADERS_OUTSIDER)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_visitor_can_read_but_not_write():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    visitor = get_generic_user(login="visitor", email="visitor@test.com")
    visitor.id = VISITOR_ID
    visitor.discord_id = "discord_visitor"
    await load_objects([visitor])
    await push_visitor(alliance, VISITOR_ID)

    read = await execute_get_request(f"/alliances/{alliance.id}/matchups", HEADERS_VISITOR)
    assert read.status_code == 200

    write = await execute_post_request(
        f"/alliances/{alliance.id}/matchups",
        _defender_payload(attacker.id, defender.id),
        HEADERS_VISITOR,
    )
    assert write.status_code == 403


@pytest.mark.asyncio
async def test_plain_member_can_read_but_not_write():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    member = get_generic_user(login="member", email="member@test.com")
    member.id = MEMBER_ID
    member.discord_id = "discord_member"
    await load_objects([member])
    await push_member(alliance, MEMBER_ID, game_pseudo="MemberPseudo")

    read = await execute_get_request(f"/alliances/{alliance.id}/matchups", HEADERS_MEMBER)
    assert read.status_code == 200

    write = await execute_post_request(
        f"/alliances/{alliance.id}/matchups",
        _defender_payload(attacker.id, defender.id),
        HEADERS_MEMBER,
    )
    assert write.status_code == 403


@pytest.mark.asyncio
async def test_officer_can_write():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    officer_user = get_generic_user(login="officer", email="officer@test.com")
    officer_user.id = MEMBER_ID
    officer_user.discord_id = "discord_officer"
    await load_objects([officer_user])
    officer_account = await push_member(alliance, MEMBER_ID, game_pseudo="OfficerPseudo")
    await push_officer(alliance, officer_account)

    response = await execute_post_request(
        f"/alliances/{alliance.id}/matchups",
        _defender_payload(attacker.id, defender.id),
        HEADERS_MEMBER,
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_delete_removes_the_rating_and_its_synergies():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    synergy = await push_champion(name="Mister Fantastic", champion_class="Science")
    route = f"/alliances/{alliance.id}/matchups"
    created = await execute_post_request(
        route,
        {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": "good",
                    "synergies": [{"champion_id": str(synergy.id), "is_required": True}],
                }
            ],
        },
        HEADERS_OWNER,
    )
    rating_id = created.json()[0]["id"]

    deleted = await execute_delete_request(f"{route}/{rating_id}", HEADERS_OWNER)
    assert deleted.status_code == 204

    listing = await execute_get_request(route, HEADERS_OWNER)
    assert listing.json() == []


@pytest.mark.asyncio
async def test_upsert_rejects_an_unknown_champion():
    alliance, _owner, _attacker, defender = await _setup_alliance_with_champions()
    payload = {
        "champion_id": str(uuid.uuid4()),
        "targets": [
            {
                "target_type": "defender",
                "defender_champion_id": str(defender.id),
                "verdict": "good",
            }
        ],
    }
    response = await execute_post_request(
        f"/alliances/{alliance.id}/matchups", payload, HEADERS_OWNER
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upsert_rejects_an_unknown_synergy_champion():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    payload = {
        "champion_id": str(attacker.id),
        "targets": [
            {
                "target_type": "defender",
                "defender_champion_id": str(defender.id),
                "verdict": "good",
                "synergies": [{"champion_id": str(uuid.uuid4()), "is_required": True}],
            }
        ],
    }
    response = await execute_post_request(
        f"/alliances/{alliance.id}/matchups", payload, HEADERS_OWNER
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upsert_can_resubmit_an_unchanged_synergy():
    """Guards the `flush()` between deleting stale synergies and re-inserting them.

    Without it SQLAlchemy emits the re-insert before the delete in one flush batch, and the
    unchanged synergy champion collides on `uq_matchup_synergy_champion`.
    """
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    synergy = await push_champion(name="Mister Fantastic", champion_class="Science")
    route = f"/alliances/{alliance.id}/matchups"

    def payload(verdict: str) -> dict:
        return {
            "champion_id": str(attacker.id),
            "targets": [
                {
                    "target_type": "defender",
                    "defender_champion_id": str(defender.id),
                    "verdict": verdict,
                    "synergies": [{"champion_id": str(synergy.id), "is_required": True}],
                }
            ],
        }

    first = await execute_post_request(route, payload("ok"), HEADERS_OWNER)
    assert first.status_code == 201
    second = await execute_post_request(route, payload("good"), HEADERS_OWNER)
    assert second.status_code == 201

    listing = await execute_get_request(route, HEADERS_OWNER)
    body = listing.json()
    assert len(body) == 1
    assert body[0]["verdict"] == "good"
    assert len(body[0]["synergies"]) == 1
