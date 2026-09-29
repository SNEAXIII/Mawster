"""Unit tests for alliance-related DTO model_validate with from_attributes."""

import uuid
from types import SimpleNamespace

from src.dto.alliance.dto_alliance import (
    AllianceMemberResponse,
    AllianceOfficerResponse,
    AllianceResponse,
)
from src.dto.alliance.dto_invitation import AllianceInvitationResponse
from src.enums.InvitationStatus import InvitationStatus
from src.enums.InvitationType import InvitationType
from src.models.Base import utcnow

# ---------------------------------------------------------------------------
# Helpers — lightweight namespace objects that mimic ORM models
# ---------------------------------------------------------------------------

TEST_ALLIANCE_NAME = "Test Alliance"


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


# ---------------------------------------------------------------------------
# AllianceOfficerResponse.model_validate
# ---------------------------------------------------------------------------


class TestAllianceOfficerResponseModelValidate:
    def test_maps_all_fields(self):
        now = utcnow()
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
        now = utcnow()
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
        strategist_ga_id = uuid.uuid4()
        strategist_member = _ns(
            id=strategist_ga_id,
            user_id=uuid.uuid4(),
            game_pseudo="Strategist1",
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
            strategists=[_ns(game_account_id=strategist_ga_id)],
            members=[owner_member, officer_member, strategist_member],
        )

        dto = AllianceResponse.model_validate(alliance)

        assert dto.name == TEST_ALLIANCE_NAME
        assert dto.tag == "TST"
        assert dto.owner_pseudo == "TheOwner"
        assert dto.member_count == 3
        assert len(dto.officers) == 1
        assert dto.officers[0].game_pseudo == "Officer1"

        # Check member flags
        owner_dto = next(m for m in dto.members if m.id == owner_id)
        assert owner_dto.is_owner is True
        officer_dto = next(m for m in dto.members if m.id == officer_ga_id)
        assert officer_dto.is_officer is True
        # `is_strategist` is the exact rank, not a capability: the officer
        # outranks a strategist but must not be flagged as one.
        assert officer_dto.is_strategist is False
        strategist_dto = next(m for m in dto.members if m.id == strategist_ga_id)
        assert strategist_dto.is_strategist is True
        assert strategist_dto.is_officer is False

    def test_empty_alliance(self):
        now = utcnow()
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
            strategists=[],
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
        now = utcnow()
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
        now = utcnow()
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
