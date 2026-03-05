"""Unit tests for DTO from_model class methods."""
import uuid
from datetime import datetime
from types import SimpleNamespace

from src.dto.dto_champion import ChampionResponse
from src.dto.dto_champion_user import ChampionUserDetailResponse, ChampionUserResponse
from src.dto.dto_upgrade_request import UpgradeRequestResponse
from src.dto.dto_defense import DefensePlacementResponse
from src.dto.dto_game_account import GameAccountResponse
from src.dto.dto_alliance import (
    AllianceMemberResponse,
    AllianceOfficerResponse,
    AllianceResponse,
)
from src.dto.dto_invitation import AllianceInvitationResponse
from src.enums.InvitationStatus import InvitationStatus


# ---------------------------------------------------------------------------
# Helpers — lightweight namespace objects that mimic ORM models
# ---------------------------------------------------------------------------

def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


def _make_champion(**overrides):
    defaults = dict(
        id=uuid.uuid4(),
        name="Spider-Man",
        champion_class="Science",
        image_url="/img/spider.png",
        is_7_star=True,
        is_ascendable=True,
        alias="spidey;peter",
    )
    defaults.update(overrides)
    return _ns(**defaults)


def _make_champion_user(champion=None, **overrides):
    champ = champion or _make_champion()
    defaults = dict(
        id=uuid.uuid4(),
        game_account_id=uuid.uuid4(),
        champion_id=champ.id,
        stars=7,
        rank=3,
        signature=200,
        is_preferred_attacker=True,
        ascension=1,
        champion=champ,
    )
    defaults.update(overrides)
    obj = _ns(**defaults)
    # Add the rarity property
    obj.rarity = f"{obj.stars}r{obj.rank}"
    return obj


# ---------------------------------------------------------------------------
# ChampionResponse.from_model
# ---------------------------------------------------------------------------

class TestChampionResponseFromModel:
    def test_maps_all_fields(self):
        champ = _make_champion()
        dto = ChampionResponse.from_model(champ)

        assert dto.id == champ.id
        assert dto.name == "Spider-Man"
        assert dto.champion_class == "Science"
        assert dto.image_url == "/img/spider.png"
        assert dto.is_7_star is True
        assert dto.is_ascendable is True
        assert dto.alias == "spidey;peter"

    def test_handles_none_optional_fields(self):
        champ = _make_champion(image_url=None, alias=None)
        dto = ChampionResponse.from_model(champ)

        assert dto.image_url is None
        assert dto.alias is None

    def test_defaults_booleans(self):
        champ = _make_champion(is_7_star=False, is_ascendable=False)
        dto = ChampionResponse.from_model(champ)

        assert dto.is_7_star is False
        assert dto.is_ascendable is False


# ---------------------------------------------------------------------------
# ChampionUserResponse.from_model
# ---------------------------------------------------------------------------

class TestChampionUserResponseFromModel:
    def test_maps_all_fields(self):
        cu = _make_champion_user()
        dto = ChampionUserResponse.from_model(cu)

        assert dto.id == cu.id
        assert dto.game_account_id == cu.game_account_id
        assert dto.champion_id == cu.champion_id
        assert dto.rarity == "7r3"
        assert dto.signature == 200
        assert dto.is_preferred_attacker is True
        assert dto.ascension == 1

    def test_default_values(self):
        cu = _make_champion_user(is_preferred_attacker=False, ascension=0)
        dto = ChampionUserResponse.from_model(cu)

        assert dto.is_preferred_attacker is False
        assert dto.ascension == 0


# ---------------------------------------------------------------------------
# ChampionUserDetailResponse.from_model
# ---------------------------------------------------------------------------

class TestChampionUserDetailResponseFromModel:
    def test_maps_champion_user_and_champion_fields(self):
        champ = _make_champion(name="Doom", champion_class="Mystic", is_ascendable=True)
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.from_model(cu)

        # ChampionUser fields
        assert dto.id == cu.id
        assert dto.rarity == "7r3"
        assert dto.signature == 200
        assert dto.is_preferred_attacker is True
        assert dto.ascension == 1

        # Champion fields
        assert dto.champion_name == "Doom"
        assert dto.champion_class == "Mystic"
        assert dto.is_ascendable is True
        assert dto.image_url == champ.image_url

    def test_inherits_from_champion_user_response(self):
        assert issubclass(ChampionUserDetailResponse, ChampionUserResponse)

    def test_non_ascendable_champion(self):
        champ = _make_champion(is_ascendable=False)
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.from_model(cu)

        assert dto.is_ascendable is False


# ---------------------------------------------------------------------------
# UpgradeRequestResponse.from_model
# ---------------------------------------------------------------------------

class TestUpgradeRequestResponseFromModel:
    def test_maps_all_fields(self):
        now = datetime.now()
        champ = _make_champion(name="Hercules", champion_class="Cosmic")
        cu = _make_champion_user(champion=champ, stars=7, rank=2)
        requester = _ns(game_pseudo="DrBalise")
        req = _ns(
            id=uuid.uuid4(),
            champion_user_id=cu.id,
            requester_game_account_id=uuid.uuid4(),
            requester=requester,
            requested_rarity="7r3",
            champion_user=cu,
            created_at=now,
            done_at=None,
        )
        dto = UpgradeRequestResponse.from_model(req)

        assert dto.id == req.id
        assert dto.requester_pseudo == "DrBalise"
        assert dto.requested_rarity == "7r3"
        assert dto.current_rarity == "7r2"
        assert dto.champion_name == "Hercules"
        assert dto.champion_class == "Cosmic"
        assert dto.image_url == champ.image_url
        assert dto.created_at == now
        assert dto.done_at is None

    def test_done_request(self):
        now = datetime.now()
        champ = _make_champion()
        cu = _make_champion_user(champion=champ)
        req = _ns(
            id=uuid.uuid4(),
            champion_user_id=cu.id,
            requester_game_account_id=uuid.uuid4(),
            requester=_ns(game_pseudo="X"),
            requested_rarity="7r4",
            champion_user=cu,
            created_at=now,
            done_at=now,
        )
        dto = UpgradeRequestResponse.from_model(req)
        assert dto.done_at == now


# ---------------------------------------------------------------------------
# DefensePlacementResponse.from_model
# ---------------------------------------------------------------------------

class TestDefensePlacementResponseFromModel:
    def test_maps_all_fields(self):
        now = datetime.now()
        champ = _make_champion(name="Corvus", champion_class="Cosmic")
        cu = _make_champion_user(champion=champ, stars=6, rank=4, ascension=0)
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
        dto = DefensePlacementResponse.from_model(placement)

        assert dto.node_number == 15
        assert dto.battlegroup == 2
        assert dto.game_pseudo == "Player1"
        assert dto.champion_name == "Corvus"
        assert dto.champion_class == "Cosmic"
        assert dto.rarity == "6r4"
        assert dto.placed_by_pseudo == "Officer1"
        assert dto.ascension == 0

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
        dto = DefensePlacementResponse.from_model(placement)
        assert dto.placed_by_id is None
        assert dto.placed_by_pseudo is None


# ---------------------------------------------------------------------------
# GameAccountResponse.from_model
# ---------------------------------------------------------------------------

class TestGameAccountResponseFromModel:
    def test_with_alliance(self):
        now = datetime.now()
        alliance = _ns(tag="TST", name="Test Alliance")
        account = _ns(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            alliance_id=uuid.uuid4(),
            alliance_group=2,
            alliance=alliance,
            game_pseudo="DrBalise",
            is_primary=True,
            created_at=now,
        )
        dto = GameAccountResponse.from_model(account)

        assert dto.alliance_tag == "TST"
        assert dto.alliance_name == "Test Alliance"
        assert dto.game_pseudo == "DrBalise"
        assert dto.is_primary is True

    def test_without_alliance(self):
        now = datetime.now()
        account = _ns(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            alliance_id=None,
            alliance_group=None,
            game_pseudo="Solo",
            is_primary=False,
            created_at=now,
        )
        # No alliance attribute at all
        dto = GameAccountResponse.from_model(account)

        assert dto.alliance_tag is None
        assert dto.alliance_name is None
        assert dto.alliance_id is None


# ---------------------------------------------------------------------------
# AllianceOfficerResponse.from_model
# ---------------------------------------------------------------------------

class TestAllianceOfficerResponseFromModel:
    def test_maps_all_fields(self):
        now = datetime.now()
        officer = _ns(
            id=uuid.uuid4(),
            game_account_id=uuid.uuid4(),
            game_account=_ns(game_pseudo="Officer1"),
            assigned_at=now,
        )
        dto = AllianceOfficerResponse.from_model(officer)

        assert dto.game_pseudo == "Officer1"
        assert dto.assigned_at == now


# ---------------------------------------------------------------------------
# AllianceMemberResponse.from_model
# ---------------------------------------------------------------------------

class TestAllianceMemberResponseFromModel:
    def test_owner(self):
        member_id = uuid.uuid4()
        member = _ns(
            id=member_id,
            user_id=uuid.uuid4(),
            game_pseudo="Owner",
            alliance_group=1,
        )
        dto = AllianceMemberResponse.from_model(
            member, owner_id=member_id, officer_ids=set(),
        )
        assert dto.is_owner is True
        assert dto.is_officer is False

    def test_officer(self):
        member_id = uuid.uuid4()
        member = _ns(
            id=member_id,
            user_id=uuid.uuid4(),
            game_pseudo="Adj",
            alliance_group=None,
        )
        dto = AllianceMemberResponse.from_model(
            member, owner_id=uuid.uuid4(), officer_ids={member_id},
        )
        assert dto.is_owner is False
        assert dto.is_officer is True

    def test_regular_member(self):
        member = _ns(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            game_pseudo="Normal",
            alliance_group=3,
        )
        dto = AllianceMemberResponse.from_model(
            member, owner_id=uuid.uuid4(), officer_ids=set(),
        )
        assert dto.is_owner is False
        assert dto.is_officer is False
        assert dto.alliance_group == 3


# ---------------------------------------------------------------------------
# AllianceResponse.from_model
# ---------------------------------------------------------------------------

class TestAllianceResponseFromModel:
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
            name="Test Alliance",
            tag="TST",
            owner_id=owner_id,
            owner=_ns(game_pseudo="TheOwner"),
            created_at=now,
            officers=[officer],
            members=[owner_member, officer_member],
        )

        dto = AllianceResponse.from_model(alliance)

        assert dto.name == "Test Alliance"
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
            officers=[],
            members=[],
        )
        dto = AllianceResponse.from_model(alliance)

        assert dto.member_count == 0
        assert dto.officers == []
        assert dto.members == []


# ---------------------------------------------------------------------------
# AllianceInvitationResponse.from_model
# ---------------------------------------------------------------------------

class TestAllianceInvitationResponseFromModel:
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
            created_at=now,
            responded_at=None,
        )
        dto = AllianceInvitationResponse.from_model(inv)

        assert dto.alliance_name == "Cool Alliance"
        assert dto.alliance_tag == "CLA"
        assert dto.game_account_pseudo == "Invitee"
        assert dto.invited_by_pseudo == "Inviter"
        assert dto.status == InvitationStatus.PENDING
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
            created_at=now,
            responded_at=now,
        )
        dto = AllianceInvitationResponse.from_model(inv)
        assert dto.status == InvitationStatus.ACCEPTED
        assert dto.responded_at == now
