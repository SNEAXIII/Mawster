"""Unit tests for ChampionUserService using mocked sessions."""
import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from src.enums.ChampionRarity import ChampionRarity
from src.models.Champion import Champion
from src.models.GameAccount import GameAccount
from src.models.ChampionUser import ChampionUser
from src.services.ChampionUserService import ChampionUserService, VALID_RARITIES
from tests.utils.utils_constant import USER_ID, GAME_PSEUDO


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CHAMPION_ID = uuid.uuid4()
GAME_ACCOUNT_ID = uuid.uuid4()


def _mock_session(mocker):
    """Return an AsyncMock pretending to be an async DB session."""
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _make_champion(name="Spider-Man", champion_class="Science") -> Champion:
    return Champion(
        id=CHAMPION_ID,
        name=name,
        champion_class=champion_class,
        is_7_star=False,
    )


def _make_game_account(user_id=USER_ID) -> GameAccount:
    return GameAccount(
        id=GAME_ACCOUNT_ID,
        user_id=user_id,
        game_pseudo=GAME_PSEUDO,
        is_primary=True,
    )


def _make_champion_user(
    game_account_id=GAME_ACCOUNT_ID,
    champion_id=CHAMPION_ID,
    rarity="6r4",
    signature=0,
) -> ChampionUser:
    stars = int(rarity.split("r")[0])
    rank = int(rarity.split("r")[1])
    return ChampionUser(
        id=uuid.uuid4(),
        game_account_id=game_account_id,
        champion_id=champion_id,
        stars=stars,
        rank=rank,
        signature=signature,
    )


# =========================================================================
# _validate_rarity
# =========================================================================


class TestValidateRarity:
    def test_valid_rarities(self):
        for rarity in VALID_RARITIES:
            ChampionUserService._validate_rarity(rarity)  # should not raise

    def test_invalid_rarity_raises(self):
        with pytest.raises(HTTPException) as exc:
            ChampionUserService._validate_rarity("invalid")
        assert exc.value.status_code == 400
        assert "Invalid rarity" in exc.value.detail

    @pytest.mark.parametrize(
        "rarity",
        ["6r3", "5r5", "8r1", "", "7R1"],
        ids=["6r3", "5r5", "8r1", "empty", "uppercase"],
    )
    def test_various_invalid_rarities(self, rarity):
        with pytest.raises(HTTPException) as exc:
            ChampionUserService._validate_rarity(rarity)
        assert exc.value.status_code == 400


# =========================================================================
# create_champion_user
# =========================================================================


class TestCreateChampionUser:
    @pytest.mark.asyncio
    async def test_create_ok(self, mocker):
        session = _mock_session(mocker)
        session.get.side_effect = [_make_game_account(), _make_champion()]
        # No existing entry
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        result = await ChampionUserService.create_champion_user(
            session, GAME_ACCOUNT_ID, CHAMPION_ID, "6r4", signature=200
        )

        assert result.rarity == "6r4"
        assert result.signature == 200
        assert result.game_account_id == GAME_ACCOUNT_ID
        assert result.champion_id == CHAMPION_ID
        session.add.assert_called_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_invalid_rarity(self, mocker):
        session = _mock_session(mocker)
        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.create_champion_user(
                session, GAME_ACCOUNT_ID, CHAMPION_ID, "invalid"
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_game_account_not_found(self, mocker):
        session = _mock_session(mocker)
        session.get.return_value = None

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.create_champion_user(
                session, GAME_ACCOUNT_ID, CHAMPION_ID, "6r4"
            )
        assert exc.value.status_code == 404
        assert "Game account" in exc.value.detail

    @pytest.mark.asyncio
    async def test_create_champion_not_found(self, mocker):
        session = _mock_session(mocker)
        session.get.side_effect = [_make_game_account(), None]

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.create_champion_user(
                session, GAME_ACCOUNT_ID, CHAMPION_ID, "6r4"
            )
        assert exc.value.status_code == 404
        assert "Champion" in exc.value.detail

    @pytest.mark.asyncio
    async def test_create_updates_existing(self, mocker):
        """If champion+rarity already exists, update signature instead of creating."""
        session = _mock_session(mocker)
        existing = _make_champion_user(rarity="6r4", signature=0)
        session.get.side_effect = [_make_game_account(), _make_champion()]
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = existing
        session.exec.return_value = result_mock

        result = await ChampionUserService.create_champion_user(
            session, GAME_ACCOUNT_ID, CHAMPION_ID, "6r4", signature=200
        )

        assert result.signature == 200
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()


# =========================================================================
# bulk_add_champions
# =========================================================================


class TestBulkAddChampions:
    @pytest.mark.asyncio
    async def test_bulk_add_ok(self, mocker):
        session = _mock_session(mocker)
        session.get.return_value = _make_game_account()
        # Mock ChampionService.get_champion_by_name to return a champion
        champion = _make_champion()
        mocker.patch(
            "src.services.ChampionUserService.ChampionService.get_champion_by_name",
            return_value=champion,
        )
        # No existing entries
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        champions = [
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 0},
            {"champion_name": "Spider-Man", "rarity": "6r5", "signature": 200},
        ]

        results = await ChampionUserService.bulk_add_champions(
            session, GAME_ACCOUNT_ID, champions
        )

        assert len(results) == 2
        assert results[0].rarity == "6r4"
        assert results[1].rarity == "6r5"
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_bulk_dedup_same_request(self, mocker):
        """If same champion+rarity appears twice, only first occurrence is kept."""
        session = _mock_session(mocker)
        session.get.return_value = _make_game_account()
        champion = _make_champion()
        mocker.patch(
            "src.services.ChampionUserService.ChampionService.get_champion_by_name",
            return_value=champion,
        )
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        champions = [
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 100},
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 200},  # duplicate
        ]

        results = await ChampionUserService.bulk_add_champions(
            session, GAME_ACCOUNT_ID, champions
        )

        assert len(results) == 1
        assert results[0].signature == 100  # first occurrence wins

    @pytest.mark.asyncio
    async def test_bulk_updates_existing_in_db(self, mocker):
        """If champion+rarity already in DB, update its signature."""
        session = _mock_session(mocker)
        existing = _make_champion_user(rarity="6r4", signature=0)
        session.get.return_value = _make_game_account()
        champion = _make_champion()
        mocker.patch(
            "src.services.ChampionUserService.ChampionService.get_champion_by_name",
            return_value=champion,
        )
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = existing
        session.exec.return_value = result_mock

        champions = [
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 200},
        ]

        results = await ChampionUserService.bulk_add_champions(
            session, GAME_ACCOUNT_ID, champions
        )

        assert len(results) == 1
        assert results[0].signature == 200

    @pytest.mark.asyncio
    async def test_bulk_game_account_not_found(self, mocker):
        session = _mock_session(mocker)
        session.get.return_value = None

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.bulk_add_champions(
                session, GAME_ACCOUNT_ID, [{"champion_name": "Spider-Man", "rarity": "6r4"}]
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_bulk_invalid_rarity(self, mocker):
        session = _mock_session(mocker)
        session.get.return_value = _make_game_account()

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.bulk_add_champions(
                session, GAME_ACCOUNT_ID, [{"champion_name": "Spider-Man", "rarity": "invalid"}]
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_bulk_champion_not_found(self, mocker):
        session = _mock_session(mocker)
        session.get.return_value = _make_game_account()
        mocker.patch(
            "src.services.ChampionUserService.ChampionService.get_champion_by_name",
            return_value=None,
        )

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.bulk_add_champions(
                session, GAME_ACCOUNT_ID, [{"champion_name": "NonExistentChamp", "rarity": "6r4"}]
            )
        assert exc.value.status_code == 404


# =========================================================================
# get_roster_by_game_account
# =========================================================================


class TestGetRosterByGameAccount:
    @pytest.mark.asyncio
    async def test_returns_entries(self, mocker):
        session = _mock_session(mocker)
        entries = [_make_champion_user(), _make_champion_user(rarity="7r3")]
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = entries
        session.exec.return_value = result_mock

        result = await ChampionUserService.get_roster_by_game_account(
            session, GAME_ACCOUNT_ID
        )

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        result = await ChampionUserService.get_roster_by_game_account(
            session, GAME_ACCOUNT_ID
        )

        assert result == []


# =========================================================================
# get_champion_user
# =========================================================================


class TestGetChampionUser:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "return_value, expected_none",
        [
            (_make_champion_user(), False),
            (None, True),
        ],
        ids=["found", "not_found"],
    )
    async def test_get_champion_user(self, mocker, return_value, expected_none):
        session = _mock_session(mocker)
        session.get.return_value = return_value

        result = await ChampionUserService.get_champion_user(session, uuid.uuid4())

        if expected_none:
            assert result is None
        else:
            assert result is return_value


# =========================================================================
# update_champion_user
# =========================================================================


class TestUpdateChampionUser:
    @pytest.mark.asyncio
    async def test_update_ok(self, mocker):
        session = _mock_session(mocker)
        entry = _make_champion_user(rarity="6r4", signature=0)

        result = await ChampionUserService.update_champion_user(
            session, entry, "7r3", signature=200
        )

        assert result.rarity == "7r3"
        assert result.signature == 200
        session.add.assert_called_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_invalid_rarity(self, mocker):
        session = _mock_session(mocker)
        entry = _make_champion_user()

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.update_champion_user(
                session, entry, "invalid", signature=0
            )
        assert exc.value.status_code == 400


# =========================================================================
# delete_champion_user
# =========================================================================


class TestDeleteChampionUser:
    @pytest.mark.asyncio
    async def test_delete_ok(self, mocker):
        session = _mock_session(mocker)
        entry = _make_champion_user()

        await ChampionUserService.delete_champion_user(session, entry)

        session.delete.assert_awaited_once_with(entry)
        session.commit.assert_awaited_once()


# =========================================================================
# delete_roster
# =========================================================================


class TestDeleteRoster:
    @pytest.mark.asyncio
    async def test_delete_roster_ok(self, mocker):
        session = _mock_session(mocker)
        entries = [_make_champion_user(), _make_champion_user(rarity="7r1")]
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = entries
        session.exec.return_value = result_mock

        count = await ChampionUserService.delete_roster(session, GAME_ACCOUNT_ID)

        assert count == 2
        assert session.delete.await_count == 2
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_roster_empty(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        count = await ChampionUserService.delete_roster(session, GAME_ACCOUNT_ID)

        assert count == 0
