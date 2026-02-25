"""Unit tests for UpgradeRequestService using mocked sessions."""
import uuid
from datetime import datetime

import pytest
from fastapi import HTTPException

from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.models.RequestedUpgrade import RequestedUpgrade
from src.services.UpgradeRequestService import UpgradeRequestService
from tests.utils.utils_constant import USER_ID, GAME_PSEUDO, GAME_PSEUDO_2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CHAMPION_ID = uuid.uuid4()
GAME_ACCOUNT_ID = uuid.uuid4()
REQUESTER_ACCOUNT_ID = uuid.uuid4()
CHAMPION_USER_ID = uuid.uuid4()


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


def _make_champion_user(
    rarity="6r4", champion_id=CHAMPION_ID, game_account_id=GAME_ACCOUNT_ID
) -> ChampionUser:
    stars = int(rarity.split("r")[0])
    rank = int(rarity.split("r")[1])
    cu = ChampionUser(
        id=CHAMPION_USER_ID,
        game_account_id=game_account_id,
        champion_id=champion_id,
        stars=stars,
        rank=rank,
        signature=0,
    )
    return cu


def _make_game_account(
    account_id=REQUESTER_ACCOUNT_ID,
    pseudo=GAME_PSEUDO_2,
) -> GameAccount:
    return GameAccount(
        id=account_id,
        user_id=USER_ID,
        game_pseudo=pseudo,
        is_primary=True,
    )


def _make_upgrade_request(
    champion_user_id=CHAMPION_USER_ID,
    requester_id=REQUESTER_ACCOUNT_ID,
    rarity="7r3",
    done_at=None,
) -> RequestedUpgrade:
    return RequestedUpgrade(
        id=uuid.uuid4(),
        champion_user_id=champion_user_id,
        requester_game_account_id=requester_id,
        requested_rarity=rarity,
        created_at=datetime.now(),
        done_at=done_at,
    )


# =========================================================================
# create_upgrade_request
# =========================================================================


class TestCreateUpgradeRequest:
    @pytest.mark.asyncio
    async def test_invalid_rarity_raises_400(self, mocker):
        session = _mock_session(mocker)
        with pytest.raises(HTTPException) as exc:
            await UpgradeRequestService.create_upgrade_request(
                session, CHAMPION_USER_ID, REQUESTER_ACCOUNT_ID, "invalid"
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_champion_user_not_found_raises_404(self, mocker):
        session = _mock_session(mocker)
        mock_result = mocker.MagicMock()
        mock_result.first.return_value = None
        session.exec.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await UpgradeRequestService.create_upgrade_request(
                session, CHAMPION_USER_ID, REQUESTER_ACCOUNT_ID, "7r3"
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_same_rarity_raises_400(self, mocker):
        session = _mock_session(mocker)
        cu = _make_champion_user(rarity="7r3")

        mock_result = mocker.MagicMock()
        mock_result.first.return_value = cu
        session.exec.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await UpgradeRequestService.create_upgrade_request(
                session, CHAMPION_USER_ID, REQUESTER_ACCOUNT_ID, "7r3"
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_lower_rarity_raises_400(self, mocker):
        session = _mock_session(mocker)
        cu = _make_champion_user(rarity="7r3")

        mock_result = mocker.MagicMock()
        mock_result.first.return_value = cu
        session.exec.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await UpgradeRequestService.create_upgrade_request(
                session, CHAMPION_USER_ID, REQUESTER_ACCOUNT_ID, "7r2"
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_duplicate_pending_raises_409(self, mocker):
        session = _mock_session(mocker)
        cu = _make_champion_user(rarity="7r1")
        existing_req = _make_upgrade_request(rarity="7r3")

        mock_result_cu = mocker.MagicMock()
        mock_result_cu.first.return_value = cu
        mock_result_dup = mocker.MagicMock()
        mock_result_dup.first.return_value = existing_req
        session.exec.side_effect = [mock_result_cu, mock_result_dup]

        with pytest.raises(HTTPException) as exc:
            await UpgradeRequestService.create_upgrade_request(
                session, CHAMPION_USER_ID, REQUESTER_ACCOUNT_ID, "7r3"
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_create_ok(self, mocker):
        session = _mock_session(mocker)
        cu = _make_champion_user(rarity="7r1")

        mock_result_cu = mocker.MagicMock()
        mock_result_cu.first.return_value = cu
        mock_result_no_dup = mocker.MagicMock()
        mock_result_no_dup.first.return_value = None
        session.exec.side_effect = [mock_result_cu, mock_result_no_dup]

        result = await UpgradeRequestService.create_upgrade_request(
            session, CHAMPION_USER_ID, REQUESTER_ACCOUNT_ID, "7r3"
        )
        assert session.add.called
        assert session.commit.called


# =========================================================================
# get_pending_by_game_account
# =========================================================================


class TestGetPendingByGameAccount:
    @pytest.mark.asyncio
    async def test_returns_list(self, mocker):
        session = _mock_session(mocker)
        req1 = _make_upgrade_request(rarity="7r3")
        req2 = _make_upgrade_request(rarity="7r4")

        mock_result = mocker.MagicMock()
        mock_result.all.return_value = [req1, req2]
        session.exec.return_value = mock_result

        result = await UpgradeRequestService.get_pending_by_game_account(
            session, GAME_ACCOUNT_ID
        )
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty(self, mocker):
        session = _mock_session(mocker)

        mock_result = mocker.MagicMock()
        mock_result.all.return_value = []
        session.exec.return_value = mock_result

        result = await UpgradeRequestService.get_pending_by_game_account(
            session, GAME_ACCOUNT_ID
        )
        assert len(result) == 0


# =========================================================================
# cancel_upgrade_request
# =========================================================================


class TestCancelUpgradeRequest:
    @pytest.mark.asyncio
    async def test_not_found_raises_404(self, mocker):
        session = _mock_session(mocker)
        session.get.return_value = None

        with pytest.raises(HTTPException) as exc:
            await UpgradeRequestService.cancel_upgrade_request(
                session, uuid.uuid4()
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_cancel_ok(self, mocker):
        session = _mock_session(mocker)
        req = _make_upgrade_request()
        session.get.return_value = req

        await UpgradeRequestService.cancel_upgrade_request(session, req.id)
        session.delete.assert_called_once_with(req)
        session.commit.assert_called()


# =========================================================================
# auto_complete_for_champion_user
# =========================================================================


class TestAutoComplete:
    @pytest.mark.asyncio
    async def test_completes_matching_requests(self, mocker):
        session = _mock_session(mocker)
        cu = _make_champion_user(rarity="7r3")
        req1 = _make_upgrade_request(rarity="7r2")
        req2 = _make_upgrade_request(rarity="7r3")

        mock_result = mocker.MagicMock()
        mock_result.all.return_value = [req1, req2]
        session.exec.return_value = mock_result

        await UpgradeRequestService.auto_complete_for_champion_user(session, cu)

        assert req1.done_at is not None
        assert req2.done_at is not None
        assert session.commit.called

    @pytest.mark.asyncio
    async def test_no_matching_requests_no_commit(self, mocker):
        session = _mock_session(mocker)
        cu = _make_champion_user(rarity="7r1")

        mock_result = mocker.MagicMock()
        mock_result.all.return_value = []
        session.exec.return_value = mock_result

        await UpgradeRequestService.auto_complete_for_champion_user(session, cu)

        assert not session.commit.called
