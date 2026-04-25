"""Unit tests for DTO model_validate with from_attributes."""

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
        "is_saga_attacker": False,
        "is_saga_defender": False,
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
    # Add the rarity property
    obj.rarity = f"{obj.stars}r{obj.rank}"
    return obj


# ---------------------------------------------------------------------------
# ChampionResponse.model_validate
# ---------------------------------------------------------------------------


class TestChampionResponseModelValidate:
    def test_maps_all_fields(self):
        champ = _make_champion()
        dto = ChampionResponse.model_validate(champ)

        assert dto.id == champ.id
        assert dto.name == "Spider-Man"
        assert dto.champion_class == "Science"
        assert dto.image_url == "/img/spider.png"
        assert dto.is_7_star is True
        assert dto.is_ascendable is True
        assert dto.has_prefight is False
        assert dto.is_saga_attacker is False
        assert dto.is_saga_defender is False
        assert dto.alias == "spidey;peter"

    def test_handles_none_optional_fields(self):
        champ = _make_champion(image_url=None, alias=None)
        dto = ChampionResponse.model_validate(champ)

        assert dto.image_url is None
        assert dto.alias is None

    def test_defaults_booleans(self):
        champ = _make_champion(is_7_star=False, is_ascendable=False)
        dto = ChampionResponse.model_validate(champ)

        assert dto.is_7_star is False
        assert dto.is_ascendable is False


# ---------------------------------------------------------------------------
# ChampionUserResponse.model_validate
# ---------------------------------------------------------------------------


class TestChampionUserResponseModelValidate:
    def test_maps_all_fields(self):
        cu = _make_champion_user()
        dto = ChampionUserResponse.model_validate(cu)

        assert dto.id == cu.id
        assert dto.game_account_id == cu.game_account_id
        assert dto.champion_id == cu.champion_id
        assert dto.rarity == "7r3"
        assert dto.signature == 200
        assert dto.is_preferred_attacker is True
        assert dto.ascension == 1

    def test_default_values(self):
        cu = _make_champion_user(is_preferred_attacker=False, ascension=0)
        dto = ChampionUserResponse.model_validate(cu)

        assert dto.is_preferred_attacker is False
        assert dto.ascension == 0


# ---------------------------------------------------------------------------
# ChampionUserDetailResponse.model_validate
# ---------------------------------------------------------------------------


class TestChampionUserDetailResponseModelValidate:
    def test_maps_champion_user_and_champion_fields(self):
        champ = _make_champion(
            name="Doom",
            champion_class="Mystic",
            is_ascendable=True,
            is_saga_attacker=True,
        )
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.model_validate(cu)

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
        assert dto.is_saga_attacker is True
        assert dto.is_saga_defender is False
        assert dto.image_url == champ.image_url

    def test_inherits_from_champion_user_response(self):
        assert issubclass(ChampionUserDetailResponse, ChampionUserResponse)

    def test_non_ascendable_champion(self):
        champ = _make_champion(is_ascendable=False)
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.model_validate(cu)

        assert dto.is_ascendable is False

    def test_saga_champion(self):
        champ = _make_champion(is_saga_attacker=True, is_saga_defender=True)
        cu = _make_champion_user(champion=champ)
        dto = ChampionUserDetailResponse.model_validate(cu)

        assert dto.is_saga_attacker is True
        assert dto.is_saga_defender is True

    def test_from_dict_passthrough(self):
        data = {
            "id": uuid.uuid4(),
            "game_account_id": uuid.uuid4(),
            "champion_id": uuid.uuid4(),
            "rarity": "7r3",
            "signature": 200,
            "is_preferred_attacker": True,
            "ascension": 1,
            "champion_name": "Doom",
            "champion_class": "Mystic",
        }
        dto = ChampionUserDetailResponse.model_validate(data)
        assert dto.champion_name == "Doom"
        assert dto.rarity == "7r3"


# ---------------------------------------------------------------------------
# UpgradeRequestResponse.model_validate
# ---------------------------------------------------------------------------


class TestUpgradeRequestResponseModelValidate:
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
        dto = UpgradeRequestResponse.model_validate(req)

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
        dto = UpgradeRequestResponse.model_validate(req)
        assert dto.done_at == now


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

    def test_saga_defender(self):
        champ = _make_champion(is_saga_attacker=True, is_saga_defender=True)
        cu = _make_champion_user(champion=champ)
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
# GameAccountResponse.model_validate
# ---------------------------------------------------------------------------


class TestGameAccountResponseModelValidate:
    def test_with_alliance(self):
        now = datetime.now()
        alliance = _ns(tag="TST", name=TEST_ALLIANCE_NAME)
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
        dto = GameAccountResponse.model_validate(account)

        assert dto.alliance_tag == "TST"
        assert dto.alliance_name == TEST_ALLIANCE_NAME
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
        dto = GameAccountResponse.model_validate(account)

        assert dto.alliance_tag is None
        assert dto.alliance_name is None
        assert dto.alliance_id is None


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
            created_at=now,
            responded_at=None,
        )
        dto = AllianceInvitationResponse.model_validate(inv)

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
        dto = AllianceInvitationResponse.model_validate(inv)
        assert dto.status == InvitationStatus.ACCEPTED
        assert dto.responded_at == now
