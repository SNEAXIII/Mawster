"""Unit tests for alliance-related DTO model_validate with from_attributes."""

import uuid
from datetime import datetime
from types import SimpleNamespace

from src.dto.alliance.dto_alliance import (
    AllianceMemberResponse,
    AllianceOfficerResponse,
    AllianceResponse,
)
from src.dto.alliance.dto_invitation import AllianceInvitationResponse
from src.dto.alliance.war.dto_defense import DefensePlacementResponse
from src.enums.InvitationStatus import InvitationStatus
from src.enums.InvitationType import InvitationType

# ---------------------------------------------------------------------------
# Helpers — lightweight namespace objects that mimic ORM models
# ---------------------------------------------------------------------------

TEST_ALLIANCE_NAME = "Test Alliance"


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


def _make_champion(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "name": "Spider-Man",
        "champion_class": "Science",
        "image_url": "/img/spider.png",
        "is_7_star": True,
        "is_ascendable": True,
        "has_prefight": False,
        "alias": "spidey;peter",
    }
    defaults.update(overrides)
    return _ns(**defaults)


def _make_champion_user(champion=None, **overrides):
    champ = champion or _make_champion()
    defaults = {
        "id": uuid.uuid4(),
        "game_account_id": uuid.uuid4(),
        "champion_id": champ.id,
        "stars": 7,
        "rank": 3,
        "signature": 200,
        "is_preferred_attacker": True,
        "ascension": 1,
        "champion": champ,
    }
    defaults.update(overrides)
    obj = _ns(**defaults)
    obj.rarity = f"{obj.stars}r{obj.rank}"
    return obj


# ---------------------------------------------------------------------------
# DefensePlacementResponse.model_validate
# ---------------------------------------------------------------------------


class TestDefensePlacementResponseModelValidate:
    def test_maps_all_fields(self):
        now = datetime.now()
        champ = _make_champion(name="Corvus", champion_class="Cosmic", alias="glaive")
        cu = _make_champion_user(
            champion=champ, stars=6, rank=4, ascension=0, signature=150, is_preferred_attacker=True
        )
        placed_by = _ns(game_pseudo="Officer1")
        placement = _ns(
            id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            battlegroup=2,
            node_number=15,
            champion_user_id=cu.id,
            game_account_id=cu.game_account_id,
            game_account=_ns(game_pseudo="Player1"),
            champion_user=cu,
            placed_by_id=uuid.uuid4(),
            placed_by=placed_by,
            created_at=now,
        )
        dto = DefensePlacementResponse.model_validate(placement)

        assert dto.node_number == 15
        assert dto.battlegroup == 2
        assert dto.game_pseudo == "Player1"
        assert dto.champion_name == "Corvus"
        assert dto.champion_alias == "glaive"
        assert dto.champion_class == "Cosmic"
        assert dto.champion_image_url == champ.image_url
        assert dto.rarity == "6r4"
        assert dto.signature == 150
        assert dto.is_preferred_attacker is True
        assert dto.placed_by_pseudo == "Officer1"
        assert dto.ascension == 0
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False

    def test_placed_by_none(self):
        now = datetime.now()
        cu = _make_champion_user()
        placement = _ns(
            id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            battlegroup=1,
            node_number=1,
            champion_user_id=cu.id,
            game_account_id=cu.game_account_id,
            game_account=_ns(game_pseudo="P"),
            champion_user=cu,
            placed_by_id=None,
            placed_by=None,
            created_at=now,
        )
        dto = DefensePlacementResponse.model_validate(placement)
        assert dto.placed_by_id is None
        assert dto.placed_by_pseudo is None

    def test_saga_defaults_false_and_is_not_read_from_champion(self):
        """Saga flags are resolved per-season by the controller (SagaService), not
        from the (now-removed) champion-level columns. model_validate must never
        read them off `.champion_user.champion`, and must always default to False."""
        cu = _make_champion_user()
        placement = _ns(
            id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            battlegroup=1,
            node_number=5,
            champion_user_id=cu.id,
            game_account_id=cu.game_account_id,
            game_account=_ns(game_pseudo="P"),
            champion_user=cu,
            placed_by_id=None,
            placed_by=None,
            created_at=datetime.now(),
        )
        dto = DefensePlacementResponse.model_validate(placement)
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False

    def test_saga_fields_settable_after_validation(self):
        """The controller sets these post-validation from SagaService.resolve_current."""
        cu = _make_champion_user()
        placement = _ns(
            id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            battlegroup=1,
            node_number=5,
            champion_user_id=cu.id,
            game_account_id=cu.game_account_id,
            game_account=_ns(game_pseudo="P"),
            champion_user=cu,
            placed_by_id=None,
            placed_by=None,
            created_at=datetime.now(),
        )
        dto = DefensePlacementResponse.model_validate(placement)
        dto.is_saga_attacker, dto.is_saga_defender = True, True
        assert dto.is_saga_attacker is True
        assert dto.is_saga_defender is True

    def test_from_dict_passthrough(self):
        data = {
            "id": uuid.uuid4(),
            "alliance_id": uuid.uuid4(),
            "battlegroup": 1,
            "node_number": 10,
            "champion_user_id": uuid.uuid4(),
            "game_account_id": uuid.uuid4(),
            "game_pseudo": "Player1",
            "champion_name": "Doom",
            "champion_class": "Mystic",
            "rarity": "7r3",
            "created_at": datetime.now(),
        }
        dto = DefensePlacementResponse.model_validate(data)
        assert dto.champion_name == "Doom"
        assert dto.game_pseudo == "Player1"


# ---------------------------------------------------------------------------
# AllianceOfficerResponse.model_validate
# ---------------------------------------------------------------------------


class TestAllianceOfficerResponseModelValidate:
    def test_maps_all_fields(self):
        now = datetime.now()
        officer = _ns(
            id=uuid.uuid4(),
            game_account_id=uuid.uuid4(),
            game_account=_ns(game_pseudo="Officer1"),
            assigned_at=now,
        )
        dto = AllianceOfficerResponse.model_validate(officer)

        assert dto.game_pseudo == "Officer1"
        assert dto.assigned_at == now


# ---------------------------------------------------------------------------
# AllianceMemberResponse.model_validate
# ---------------------------------------------------------------------------


class TestAllianceMemberResponseModelValidate:
    def test_owner(self):
        member_id = uuid.uuid4()
        dto = AllianceMemberResponse.model_validate(
            {
                "id": member_id,
                "user_id": uuid.uuid4(),
                "game_pseudo": "Owner",
                "alliance_group": 1,
                "is_owner": True,
                "is_officer": False,
            }
        )
        assert dto.is_owner is True
        assert dto.is_officer is False

    def test_officer(self):
        dto = AllianceMemberResponse.model_validate(
            {
                "id": uuid.uuid4(),
                "user_id": uuid.uuid4(),
                "game_pseudo": "Adj",
                "alliance_group": None,
                "is_owner": False,
                "is_officer": True,
            }
        )
        assert dto.is_owner is False
        assert dto.is_officer is True

    def test_regular_member(self):
        dto = AllianceMemberResponse.model_validate(
            {
                "id": uuid.uuid4(),
                "user_id": uuid.uuid4(),
                "game_pseudo": "Normal",
                "alliance_group": 3,
                "is_owner": False,
                "is_officer": False,
            }
        )
        assert dto.is_owner is False
        assert dto.is_officer is False
        assert dto.alliance_group == 3


# ---------------------------------------------------------------------------
# AllianceResponse.model_validate
# ---------------------------------------------------------------------------


class TestAllianceResponseModelValidate:
    def test_maps_full_alliance(self):
        now = datetime.now()
        owner_id = uuid.uuid4()
        officer_ga_id = uuid.uuid4()

        officer = _ns(
            id=uuid.uuid4(),
            game_account_id=officer_ga_id,
            game_account=_ns(game_pseudo="Officer1"),
            assigned_at=now,
        )
        owner_member = _ns(
            id=owner_id,
            user_id=uuid.uuid4(),
            game_pseudo="TheOwner",
            alliance_group=1,
        )
        officer_member = _ns(
            id=officer_ga_id,
            user_id=uuid.uuid4(),
            game_pseudo="Officer1",
            alliance_group=1,
        )
        alliance = _ns(
            id=uuid.uuid4(),
            name=TEST_ALLIANCE_NAME,
            tag="TST",
            owner_id=owner_id,
            owner=_ns(game_pseudo="TheOwner"),
            created_at=now,
            elo=0,
            tier=20,
            officers=[officer],
            members=[owner_member, officer_member],
        )

        dto = AllianceResponse.model_validate(alliance)

        assert dto.name == TEST_ALLIANCE_NAME
        assert dto.tag == "TST"
        assert dto.owner_pseudo == "TheOwner"
        assert dto.member_count == 2
        assert len(dto.officers) == 1
        assert dto.officers[0].game_pseudo == "Officer1"

        # Check member flags
        owner_dto = next(m for m in dto.members if m.id == owner_id)
        assert owner_dto.is_owner is True
        officer_dto = next(m for m in dto.members if m.id == officer_ga_id)
        assert officer_dto.is_officer is True

    def test_empty_alliance(self):
        now = datetime.now()
        alliance = _ns(
            id=uuid.uuid4(),
            name="Empty",
            tag="EMP",
            owner_id=uuid.uuid4(),
            owner=_ns(game_pseudo="Solo"),
            created_at=now,
            elo=0,
            tier=20,
            officers=[],
            members=[],
        )
        dto = AllianceResponse.model_validate(alliance)

        assert dto.member_count == 0
        assert dto.officers == []
        assert dto.members == []


# ---------------------------------------------------------------------------
# AllianceInvitationResponse.model_validate
# ---------------------------------------------------------------------------


class TestAllianceInvitationResponseModelValidate:
    def test_maps_all_fields(self):
        now = datetime.now()
        inv = _ns(
            id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            alliance=_ns(name="Cool Alliance", tag="CLA"),
            game_account_id=uuid.uuid4(),
            game_account=_ns(game_pseudo="Invitee"),
            invited_by_game_account_id=uuid.uuid4(),
            invited_by=_ns(game_pseudo="Inviter"),
            status=InvitationStatus.PENDING,
            type=InvitationType.MEMBER,
            created_at=now,
            responded_at=None,
        )
        dto = AllianceInvitationResponse.model_validate(inv)

        assert dto.alliance_name == "Cool Alliance"
        assert dto.alliance_tag == "CLA"
        assert dto.game_account_pseudo == "Invitee"
        assert dto.invited_by_pseudo == "Inviter"
        assert dto.status == InvitationStatus.PENDING
        assert dto.type == InvitationType.MEMBER
        assert dto.responded_at is None

    def test_accepted_invitation(self):
        now = datetime.now()
        inv = _ns(
            id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            alliance=_ns(name="X", tag="X"),
            game_account_id=uuid.uuid4(),
            game_account=_ns(game_pseudo="P"),
            invited_by_game_account_id=uuid.uuid4(),
            invited_by=_ns(game_pseudo="Q"),
            status=InvitationStatus.ACCEPTED,
            type=InvitationType.MEMBER,
            created_at=now,
            responded_at=now,
        )
        dto = AllianceInvitationResponse.model_validate(inv)
        assert dto.status == InvitationStatus.ACCEPTED
        assert dto.type == InvitationType.MEMBER
        assert dto.responded_at == now
