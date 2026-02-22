"""Unit tests for ChampionService using mocked sessions."""
import uuid
from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import HTTPException

from src.models.Champion import Champion
from src.services.ChampionService import ChampionService, VALID_CLASSES
from src.dto.dto_game import ChampionLoadRequest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CHAMPION_NAME = "Spider-Man"
CHAMPION_NAME_2 = "Wolverine"
CHAMPION_CLASS = "Science"
CHAMPION_ALIAS = "spidey;peter"


def _mock_session(mocker):
    """Return an AsyncMock pretending to be an async DB session."""
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _make_champion(
    name=CHAMPION_NAME,
    champion_class=CHAMPION_CLASS,
    image_url=None,
    is_7_star=False,
    alias=None,
    champion_id=None,
) -> Champion:
    return Champion(
        id=champion_id or uuid.uuid4(),
        name=name,
        champion_class=champion_class,
        image_url=image_url,
        is_7_star=is_7_star,
        alias=alias,
    )


# =========================================================================
# get_champion_by_id
# =========================================================================


class TestGetChampionById:
    @pytest.mark.asyncio
    async def test_found(self, mocker):
        session = _mock_session(mocker)
        champ = _make_champion()
        session.get.return_value = champ

        result = await ChampionService.get_champion_by_id(session, champ.id)
        assert result is champ

    @pytest.mark.asyncio
    async def test_not_found_raises_404(self, mocker):
        session = _mock_session(mocker)
        session.get.return_value = None

        with pytest.raises(HTTPException) as exc:
            await ChampionService.get_champion_by_id(session, uuid.uuid4())
        assert exc.value.status_code == 404


# =========================================================================
# get_champion_by_name
# =========================================================================


class TestGetChampionByName:
    @pytest.mark.asyncio
    async def test_found(self, mocker):
        session = _mock_session(mocker)
        champ = _make_champion()
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = champ
        session.exec.return_value = result_mock

        result = await ChampionService.get_champion_by_name(session, CHAMPION_NAME)
        assert result is champ

    @pytest.mark.asyncio
    async def test_not_found_returns_none(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        result = await ChampionService.get_champion_by_name(session, "NonExistent")
        assert result is None


# =========================================================================
# get_total_champions
# =========================================================================


class TestGetTotalChampions:
    @pytest.mark.asyncio
    async def test_returns_count(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.one.return_value = 42
        session.exec.return_value = result_mock

        total = await ChampionService.get_total_champions(session)
        assert total == 42

    @pytest.mark.asyncio
    async def test_with_class_filter(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.one.return_value = 10
        session.exec.return_value = result_mock

        total = await ChampionService.get_total_champions(
            session, champion_class="Science"
        )
        assert total == 10

    @pytest.mark.asyncio
    async def test_with_search_filter(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.one.return_value = 3
        session.exec.return_value = result_mock

        total = await ChampionService.get_total_champions(session, search="spider")
        assert total == 3


# =========================================================================
# get_champions_paginated
# =========================================================================


class TestGetChampionsPaginated:
    @pytest.mark.asyncio
    async def test_returns_list(self, mocker):
        session = _mock_session(mocker)
        champs = [_make_champion(), _make_champion(name=CHAMPION_NAME_2, champion_class="Mutant")]
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = champs
        session.exec.return_value = result_mock

        result = await ChampionService.get_champions_paginated(session, page=1, size=10)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        result = await ChampionService.get_champions_paginated(session, page=1, size=10)
        assert result == []

    @pytest.mark.asyncio
    async def test_with_filters(self, mocker):
        session = _mock_session(mocker)
        champs = [_make_champion()]
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = champs
        session.exec.return_value = result_mock

        result = await ChampionService.get_champions_paginated(
            session, page=1, size=10, champion_class="Science", search="spider"
        )
        assert len(result) == 1


# =========================================================================
# get_champions_with_pagination
# =========================================================================


class TestGetChampionsWithPagination:
    @pytest.mark.asyncio
    async def test_returns_dto(self, mocker):
        session = _mock_session(mocker)
        champs = [_make_champion(), _make_champion(name=CHAMPION_NAME_2, champion_class="Mutant")]

        # Mock get_total_champions
        mocker.patch.object(
            ChampionService, "get_total_champions", return_value=2
        )
        # Mock get_champions_paginated
        mocker.patch.object(
            ChampionService, "get_champions_paginated", return_value=champs
        )

        result = await ChampionService.get_champions_with_pagination(
            session, page=1, size=10
        )
        assert result.total_champions == 2
        assert result.total_pages == 1
        assert result.current_page == 1
        assert len(result.champions) == 2

    @pytest.mark.asyncio
    async def test_calculates_total_pages(self, mocker):
        session = _mock_session(mocker)

        mocker.patch.object(ChampionService, "get_total_champions", return_value=25)
        mocker.patch.object(
            ChampionService, "get_champions_paginated", return_value=[]
        )

        result = await ChampionService.get_champions_with_pagination(
            session, page=1, size=10
        )
        assert result.total_pages == 3  # ceil(25/10)

    @pytest.mark.asyncio
    async def test_zero_champions(self, mocker):
        session = _mock_session(mocker)

        mocker.patch.object(ChampionService, "get_total_champions", return_value=0)
        mocker.patch.object(
            ChampionService, "get_champions_paginated", return_value=[]
        )

        result = await ChampionService.get_champions_with_pagination(
            session, page=1, size=10
        )
        assert result.total_champions == 0
        assert result.total_pages == 0
        assert len(result.champions) == 0


# =========================================================================
# update_alias
# =========================================================================


class TestUpdateAlias:
    @pytest.mark.asyncio
    async def test_update_ok(self, mocker):
        session = _mock_session(mocker)
        champ = _make_champion()
        mocker.patch.object(
            ChampionService, "get_champion_by_id", return_value=champ
        )

        result = await ChampionService.update_alias(
            session, champ.id, CHAMPION_ALIAS
        )
        assert result.alias == CHAMPION_ALIAS
        session.add.assert_called_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_alias_to_none(self, mocker):
        session = _mock_session(mocker)
        champ = _make_champion(alias=CHAMPION_ALIAS)
        mocker.patch.object(
            ChampionService, "get_champion_by_id", return_value=champ
        )

        result = await ChampionService.update_alias(session, champ.id, None)
        assert result.alias is None

    @pytest.mark.asyncio
    async def test_update_alias_champion_not_found(self, mocker):
        session = _mock_session(mocker)
        mocker.patch.object(
            ChampionService,
            "get_champion_by_id",
            side_effect=HTTPException(status_code=404, detail="Not found"),
        )

        with pytest.raises(HTTPException) as exc:
            await ChampionService.update_alias(session, uuid.uuid4(), "alias")
        assert exc.value.status_code == 404


# =========================================================================
# load_champions
# =========================================================================


class TestLoadChampions:
    @pytest.mark.asyncio
    async def test_create_new_champions(self, mocker):
        session = _mock_session(mocker)
        mocker.patch.object(
            ChampionService, "get_champion_by_name", return_value=None
        )

        data = [
            ChampionLoadRequest(
                name="Spider-Man", champion_class="Science", image_filename="spider_man.png"
            ),
            ChampionLoadRequest(
                name="Wolverine", champion_class="Mutant", image_filename="wolverine.png"
            ),
        ]

        result = await ChampionService.load_champions(session, data)
        assert result["created"] == 2
        assert result["updated"] == 0
        assert result["skipped"] == 0
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_existing_champion(self, mocker):
        session = _mock_session(mocker)
        existing = _make_champion()
        mocker.patch.object(
            ChampionService, "get_champion_by_name", return_value=existing
        )

        data = [
            ChampionLoadRequest(
                name="Spider-Man", champion_class="Science", image_filename="new_spider.png"
            ),
        ]

        result = await ChampionService.load_champions(session, data)
        assert result["created"] == 0
        assert result["updated"] == 1
        assert result["skipped"] == 0

    @pytest.mark.asyncio
    async def test_skip_invalid_class(self, mocker):
        session = _mock_session(mocker)

        data = [
            ChampionLoadRequest(
                name="FakeChamp", champion_class="InvalidClass", image_filename="fake.png"
            ),
        ]

        result = await ChampionService.load_champions(session, data)
        assert result["created"] == 0
        assert result["updated"] == 0
        assert result["skipped"] == 1

    @pytest.mark.asyncio
    async def test_mixed_create_update_skip(self, mocker):
        session = _mock_session(mocker)
        existing = _make_champion(name="Existing")

        async def mock_get_by_name(session, name):
            if name == "Existing":
                return existing
            return None

        mocker.patch.object(
            ChampionService, "get_champion_by_name", side_effect=mock_get_by_name
        )

        data = [
            ChampionLoadRequest(name="NewChamp", champion_class="Cosmic", image_filename="new.png"),
            ChampionLoadRequest(name="Existing", champion_class="Science", image_filename="exist.png"),
            ChampionLoadRequest(name="BadClass", champion_class="Fake", image_filename="bad.png"),
        ]

        result = await ChampionService.load_champions(session, data)
        assert result["created"] == 1
        assert result["updated"] == 1
        assert result["skipped"] == 1

    @pytest.mark.asyncio
    async def test_load_without_image(self, mocker):
        session = _mock_session(mocker)
        mocker.patch.object(
            ChampionService, "get_champion_by_name", return_value=None
        )

        data = [
            ChampionLoadRequest(
                name="NoImageChamp", champion_class="Tech", image_filename=None
            ),
        ]

        result = await ChampionService.load_champions(session, data)
        assert result["created"] == 1


# =========================================================================
# delete_champion
# =========================================================================


class TestDeleteChampion:
    @pytest.mark.asyncio
    async def test_delete_ok(self, mocker):
        session = _mock_session(mocker)
        champ = _make_champion()
        mocker.patch.object(
            ChampionService, "get_champion_by_id", return_value=champ
        )

        await ChampionService.delete_champion(session, champ.id)
        session.delete.assert_awaited_once_with(champ)
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_not_found(self, mocker):
        session = _mock_session(mocker)
        mocker.patch.object(
            ChampionService,
            "get_champion_by_id",
            side_effect=HTTPException(status_code=404, detail="Not found"),
        )

        with pytest.raises(HTTPException) as exc:
            await ChampionService.delete_champion(session, uuid.uuid4())
        assert exc.value.status_code == 404


# =========================================================================
# VALID_CLASSES constant
# =========================================================================


class TestValidClasses:
    def test_all_classes_present(self):
        expected = {"Science", "Cosmic", "Mutant", "Skill", "Tech", "Mystic"}
        assert VALID_CLASSES == expected
