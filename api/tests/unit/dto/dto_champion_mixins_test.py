"""The champion DTO mixins must stay a pure factoring of what each DTO already declared.

A mixin that quietly adds, drops or re-types a field changes the API contract, so these
lock the field sets down by name rather than trusting inheritance to behave.
"""

import pytest

from src.dto.account.game.dto_champion_user import (
    ChampionUserBulkEntry,
    ChampionUserCreateRequest,
    ChampionUserDetailResponse,
)
from src.dto.account.game.dto_upgrade_request import UpgradeRequestResponse
from src.dto.admin.dto_champion import ChampionResponse
from src.dto.admin.dto_fight_record import (
    ChampionUserSnapshotResponse,
    WarFightRecordResponse,
)
from src.dto.alliance.dto_alliance_roster import AllianceRosterEntryResponse
from src.dto.alliance.dto_matchup import ChampionRef as MatchupChampionRef
from src.dto.alliance.war.dto_defense import DefensePlacementResponse
from src.dto.alliance.war.dto_war import (
    AvailableAttackerResponse,
    AvailablePrefightAttackerResponse,
    WarPlacementResponse,
    WarPrefightResponse,
    WarSynergyResponse,
)
from src.dto.mixins import ChampionIdentity, ChampionRef, RosterEntryInput, SagaRoles

CHAMPION_IDENTITY_FIELDS = {"champion_name", "champion_class", "image_url"}
SAGA_FIELDS = {"is_saga_attacker", "is_saga_defender"}

IDENTITY_CARRIERS = [
    ChampionUserDetailResponse,
    UpgradeRequestResponse,
    ChampionUserSnapshotResponse,
    WarFightRecordResponse,
    AllianceRosterEntryResponse,
    WarPlacementResponse,
    AvailableAttackerResponse,
    AvailablePrefightAttackerResponse,
    WarSynergyResponse,
    WarPrefightResponse,
]

SAGA_CARRIERS = [
    ChampionUserDetailResponse,
    ChampionResponse,
    AllianceRosterEntryResponse,
    WarPlacementResponse,
    AvailableAttackerResponse,
    AvailablePrefightAttackerResponse,
    WarSynergyResponse,
    WarPrefightResponse,
    DefensePlacementResponse,
]

REF_CARRIERS = [
    ChampionUserSnapshotResponse,
    WarFightRecordResponse,
    AllianceRosterEntryResponse,
    WarPlacementResponse,
    AvailableAttackerResponse,
    AvailablePrefightAttackerResponse,
]


class TestChampionIdentity:
    def test_declares_exactly_the_rendering_fields(self):
        assert set(ChampionIdentity.model_fields) == CHAMPION_IDENTITY_FIELDS

    @pytest.mark.parametrize("dto", IDENTITY_CARRIERS)
    def test_carrier_exposes_the_identity_fields(self, dto):
        assert set(dto.model_fields) >= CHAMPION_IDENTITY_FIELDS

    @pytest.mark.parametrize("dto", IDENTITY_CARRIERS)
    def test_image_url_stays_optional(self, dto):
        """A response must never reject a champion the DB stored without a portrait."""
        assert not dto.model_fields["image_url"].is_required()

    @pytest.mark.parametrize("dto", IDENTITY_CARRIERS)
    def test_name_and_class_stay_permissive_strings(self, dto):
        """No enum here: the DB predates any closed set and a response must not reject it."""
        assert dto.model_fields["champion_name"].annotation is str
        assert dto.model_fields["champion_class"].annotation is str


class TestChampionRef:
    def test_adds_only_the_id_to_the_identity(self):
        assert set(ChampionRef.model_fields) == CHAMPION_IDENTITY_FIELDS | {"champion_id"}

    def test_matchup_reexport_is_the_shared_class(self):
        """MatchupService imports ChampionRef from dto_matchup; it must be the same class."""
        assert MatchupChampionRef is ChampionRef

    @pytest.mark.parametrize("dto", REF_CARRIERS)
    def test_carrier_exposes_the_champion_id(self, dto):
        assert "champion_id" in dto.model_fields


class TestSagaRoles:
    def test_declares_exactly_the_two_flags(self):
        assert set(SagaRoles.model_fields) == SAGA_FIELDS

    @pytest.mark.parametrize("dto", SAGA_CARRIERS)
    def test_carrier_defaults_both_flags_to_false(self, dto):
        """They are only meaningful for a season-scoped query, so absent must mean False."""
        for field in SAGA_FIELDS:
            assert dto.model_fields[field].default is False


class TestRosterEntryInput:
    def test_declares_exactly_the_player_stated_fields(self):
        expected = {"rarity", "signature", "is_preferred_attacker", "ascension"}
        assert set(RosterEntryInput.model_fields) == expected

    @pytest.mark.parametrize("dto", [ChampionUserCreateRequest, ChampionUserBulkEntry])
    def test_request_keeps_its_bounds(self, dto):
        """Unlike the response mixins, an input mixin must still reject bad values."""
        payload = _roster_payload(dto, ascension=3)
        with pytest.raises(ValueError, match="ascension"):
            dto.model_validate(payload)

    @pytest.mark.parametrize("dto", [ChampionUserCreateRequest, ChampionUserBulkEntry])
    def test_rarity_is_not_validated_by_the_dto(self, dto):
        """The service returns a 400 listing the valid codes; an enum here would make it a 422."""
        assert dto.model_validate(_roster_payload(dto, rarity="9r9")).rarity == "9r9"

    @pytest.mark.parametrize("dto", [ChampionUserCreateRequest, ChampionUserBulkEntry])
    def test_optional_fields_keep_their_defaults(self, dto):
        entry = dto.model_validate(_roster_payload(dto))
        assert entry.signature == 0
        assert entry.ascension == 0
        assert entry.is_preferred_attacker is False


def _roster_payload(dto, **overrides):
    """A minimal valid payload for either roster-input DTO, which differ in how they name a champion."""
    payload = {"rarity": "6r4"}
    if "champion_id" in dto.model_fields:
        payload["game_account_id"] = "550e8400-e29b-41d4-a716-446655440000"
        payload["champion_id"] = "550e8400-e29b-41d4-a716-446655440001"
    else:
        payload["champion_name"] = "Spider-Man"
    return payload | overrides
