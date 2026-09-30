"""Unit tests for ChampionUserService using mocked sessions."""

import uuid

import pytest
from fastapi import HTTPException

from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.user.GameAccount import GameAccount
from src.services.account.game.ChampionUserService import VALID_RARITIES, ChampionUserService
from tests.utils.utils_constant import GAME_PSEUDO, USER_ID

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CHAMPION_ID = uuid.uuid4()
GAME_ACCOUNT_ID = uuid.uuid4()


MOCK_GET_CHAMPION_BY_NAME = (
    "src.services.account.game.ChampionUserService.ChampionService.get_champion_by_name"
)


def _mock_session(mocker):
    """Return an AsyncMock pretending to be an async DB session."""
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    # Prevent UpgradeRequestService.auto_complete from interfering with unit tests
    mocker.patch(
        "src.services.account.game.ChampionUserService.UpgradeRequestService.auto_complete_for_champion_users",
        return_value=None,
    )
    return session


def _make_champion(name="Spider-Man", champion_class="Science") -> Champion:
    return Champion(
        id=CHAMPION_ID,
        name=name,
        champion_class=champion_class,
        is_7_stars_available=False,
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


def _bulk_session(mocker, champions: list[Champion], roster: list[ChampionUser]):
    """Session answering the three bulk queries: champions by name, roster, reload."""
    session = _mock_session(mocker)
    session.get.return_value = _make_game_account()
    results = [mocker.MagicMock() for _ in range(3)]
    results[0].all.return_value = champions
    results[1].all.return_value = roster
    results[2].all.side_effect = lambda: [c.args[0] for c in session.add.call_args_list]
    session.exec.side_effect = results
    return session


class TestBulkAddChampions:
    @pytest.mark.asyncio
    async def test_bulk_add_ok(self, mocker):
        session = _bulk_session(mocker, [_make_champion()], [])
        champions = [
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 0},
            {"champion_name": "Spider-Man", "rarity": "7r3", "signature": 200},
        ]

        results = await ChampionUserService.bulk_add_champions(session, GAME_ACCOUNT_ID, champions)

        assert [r.rarity for r in results] == ["6r4", "7r3"]
        assert session.exec.await_count == 3
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_bulk_dedup_same_request(self, mocker):
        """If same champion+rarity appears twice, only first occurrence is kept."""
        session = _bulk_session(mocker, [_make_champion()], [])
        champions = [
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 100},
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 200},  # duplicate
        ]

        results = await ChampionUserService.bulk_add_champions(session, GAME_ACCOUNT_ID, champions)

        assert len(results) == 1
        assert results[0].signature == 100  # first occurrence wins

    @pytest.mark.asyncio
    async def test_bulk_updates_existing_in_db(self, mocker):
        """If champion+rarity already in DB, update its signature."""
        existing = _make_champion_user(rarity="6r4", signature=0)
        session = _bulk_session(mocker, [_make_champion()], [existing])
        champions = [
            {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 200},
        ]

        results = await ChampionUserService.bulk_add_champions(session, GAME_ACCOUNT_ID, champions)

        assert results == [existing]
        assert existing.signature == 200

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
        session = _bulk_session(mocker, [], [])

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.bulk_add_champions(
                session, GAME_ACCOUNT_ID, [{"champion_name": "Spider-Man", "rarity": "invalid"}]
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_bulk_champion_not_found(self, mocker):
        session = _bulk_session(mocker, [], [])
        mocker.patch(
            MOCK_GET_CHAMPION_BY_NAME,
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

        result = await ChampionUserService.get_roster_by_game_account(session, GAME_ACCOUNT_ID)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        result = await ChampionUserService.get_roster_by_game_account(session, GAME_ACCOUNT_ID)

        assert result == []


# =========================================================================
# get_champion_user
# =========================================================================


class TestGetChampionUser:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("return_value", "expected_none"),
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
            await ChampionUserService.update_champion_user(session, entry, "invalid", signature=0)
        assert exc.value.status_code == 400


# =========================================================================
# delete_champion_user
# =========================================================================


class TestDeleteChampionUser:
    @pytest.mark.asyncio
    async def test_delete_ok(self, mocker):
        session = _mock_session(mocker)
        entry = _make_champion_user()
        # release_champion_user finds no defense plan node to release
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        await ChampionUserService.delete_champion_user(session, entry)

        session.flush.assert_awaited_once()
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
        roster_result = mocker.MagicMock()
        roster_result.all.return_value = entries
        # release_champion_users finds no defense plan node to release
        release_result = mocker.MagicMock()
        release_result.all.return_value = []
        session.exec.side_effect = [roster_result, release_result]

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


# =========================================================================
# upgrade_champion_rank
# =========================================================================


class TestUpgradeChampionRank:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("before", "after"),
        [
            ("6r4", "6r5"),
            ("7r1", "7r2"),
            ("7r2", "7r3"),
            ("7r3", "7r4"),
            ("7r4", "7r5"),
        ],
    )
    async def test_upgrade_ok(self, mocker, before, after):
        session = _mock_session(mocker)
        entry = _make_champion_user(rarity=before, signature=42)

        result = await ChampionUserService.upgrade_champion_rank(session, entry)

        assert result.rarity == after
        assert result.signature == 42  # preserved
        session.add.assert_called_once_with(entry)
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once_with(entry)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("rarity", ["6r5", "7r6"])
    async def test_upgrade_max_rank_raises_400(self, mocker, rarity):
        session = _mock_session(mocker)
        entry = _make_champion_user(rarity=rarity)

        with pytest.raises(HTTPException) as exc_info:
            await ChampionUserService.upgrade_champion_rank(session, entry)

        assert exc_info.value.status_code == 400


# =========================================================================
# _validate_ascension
# =========================================================================


class TestValidateAscension:
    def test_valid_ascension_values(self):
        champion = _make_champion()
        champion.is_ascendable = True
        for val in (0, 1, 2):
            result = ChampionUserService._validate_ascension(val, champion)
            assert result == val

    def test_invalid_ascension_raises_400(self):
        champion = _make_champion()
        champion.is_ascendable = True
        with pytest.raises(HTTPException) as exc:
            ChampionUserService._validate_ascension(3, champion)
        assert exc.value.status_code == 400

    def test_not_ascendable_forces_zero(self):
        champion = _make_champion()
        champion.is_ascendable = False
        result = ChampionUserService._validate_ascension(2, champion)
        assert result == 0

    def test_negative_ascension_raises_400(self):
        champion = _make_champion()
        champion.is_ascendable = True
        with pytest.raises(HTTPException) as exc:
            ChampionUserService._validate_ascension(-1, champion)
        assert exc.value.status_code == 400


# =========================================================================
# ascend_champion
# =========================================================================


class TestAscendChampion:
    @pytest.mark.asyncio
    async def test_ascend_ok(self, mocker):
        session = _mock_session(mocker)
        champion = _make_champion()
        champion.is_ascendable = True
        entry = _make_champion_user(rarity="7r5")
        entry.ascension = 0
        session.get.return_value = champion

        result = await ChampionUserService.ascend_champion(session, entry)
        assert result.ascension == 1
        session.add.assert_called_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ascend_from_1_to_2(self, mocker):
        session = _mock_session(mocker)
        champion = _make_champion()
        champion.is_ascendable = True
        entry = _make_champion_user(rarity="7r5")
        entry.ascension = 1
        session.get.return_value = champion

        result = await ChampionUserService.ascend_champion(session, entry)
        assert result.ascension == 2

    @pytest.mark.asyncio
    async def test_ascend_max_raises_400(self, mocker):
        session = _mock_session(mocker)
        champion = _make_champion()
        champion.is_ascendable = True
        entry = _make_champion_user(rarity="7r5")
        entry.ascension = 2
        session.get.return_value = champion

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.ascend_champion(session, entry)
        assert exc.value.status_code == 400
        assert "maximum ascension" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_ascend_not_ascendable_raises_400(self, mocker):
        session = _mock_session(mocker)
        champion = _make_champion()
        champion.is_ascendable = False
        entry = _make_champion_user(rarity="7r5")
        entry.ascension = 0
        session.get.return_value = champion

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.ascend_champion(session, entry)
        assert exc.value.status_code == 400
        assert "cannot be ascended" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_ascend_champion_not_found_raises_404(self, mocker):
        session = _mock_session(mocker)
        entry = _make_champion_user(rarity="7r5")
        entry.ascension = 0
        session.get.return_value = None

        with pytest.raises(HTTPException) as exc:
            await ChampionUserService.ascend_champion(session, entry)
        assert exc.value.status_code == 404
        assert "not found" in exc.value.detail.lower()
