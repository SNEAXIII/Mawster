"""Unit tests for DefensePlacementService – export / import logic."""
import uuid

import pytest

from src.dto.dto_defense import (
    DefenseExportItem,
    DefenseReportItem,
)
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.models.DefensePlacement import DefensePlacement
from src.services.DefensePlacementService import (
    DefensePlacementService,
    MAX_DEFENDERS_PER_PLAYER,
)

# ─── Constants ────────────────────────────────────────────

ALLIANCE_ID = uuid.uuid4()
BG = 1
OWNER_GA_ID = uuid.uuid4()
MEMBER_GA_ID = uuid.uuid4()

CHAMP_SPIDER = Champion(
    id=uuid.uuid4(), name="Spider-Man", champion_class="Science", image_url="/champs/spider.png"
)
CHAMP_WOLVERINE = Champion(
    id=uuid.uuid4(), name="Wolverine", champion_class="Mutant", image_url="/champs/wolverine.png"
)


# ─── Helpers ──────────────────────────────────────────────


def _fake_placement(
    node: int,
    champion: Champion,
    ga_id: uuid.UUID,
    ga_pseudo: str,
    stars: int = 7,
    rank: int = 3,
) -> DefensePlacement:
    """Return a lightweight DefensePlacement with the eagerly-loaded relations faked."""
    cu = ChampionUser(
        id=uuid.uuid4(),
        game_account_id=ga_id,
        champion_id=champion.id,
        stars=stars,
        rank=rank,
    )
    cu.champion = champion  # type: ignore[attr-defined]

    ga = GameAccount(id=ga_id, user_id=uuid.uuid4(), game_pseudo=ga_pseudo, is_primary=True)

    p = DefensePlacement(
        id=uuid.uuid4(),
        alliance_id=ALLIANCE_ID,
        battlegroup=BG,
        node_number=node,
        champion_user_id=cu.id,
        game_account_id=ga_id,
    )
    p.champion_user = cu  # type: ignore[attr-defined]
    p.game_account = ga  # type: ignore[attr-defined]
    return p


# =========================================================================
# export_defense
# =========================================================================


class TestExportDefense:
    """Unit tests for DefensePlacementService.export_defense."""

    @pytest.mark.asyncio
    async def test_export_empty(self, mocker):
        """Export with no placements returns []."""
        session = mocker.AsyncMock()
        mocker.patch.object(
            DefensePlacementService, "get_defense", return_value=[]
        )

        result = await DefensePlacementService.export_defense(
            session, ALLIANCE_ID, BG
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_export_returns_items(self, mocker):
        """Export returns DefenseExportItem for each placement."""
        placements = [
            _fake_placement(1, CHAMP_SPIDER, OWNER_GA_ID, "OwnerPseudo"),
            _fake_placement(10, CHAMP_WOLVERINE, MEMBER_GA_ID, "MemberPseudo", stars=6, rank=5),
        ]
        session = mocker.AsyncMock()
        mocker.patch.object(
            DefensePlacementService, "get_defense", return_value=placements
        )

        result = await DefensePlacementService.export_defense(
            session, ALLIANCE_ID, BG
        )

        assert len(result) == 2
        assert all(isinstance(i, DefenseExportItem) for i in result)

        # Verify first item
        assert result[0].champion_name == "Spider-Man"
        assert result[0].rarity == "7r3"
        assert result[0].node_number == 1
        assert result[0].owner_name == "OwnerPseudo"

        # Verify second item
        assert result[1].champion_name == "Wolverine"
        assert result[1].rarity == "6r5"
        assert result[1].node_number == 10
        assert result[1].owner_name == "MemberPseudo"


# =========================================================================
# _report_snapshot
# =========================================================================


class TestReportSnapshot:
    """Unit tests for DefensePlacementService._report_snapshot."""

    @pytest.mark.asyncio
    async def test_snapshot_includes_class_and_image(self, mocker):
        """Snapshot returns DefenseReportItem with champion_class and image_url."""
        placements = [
            _fake_placement(5, CHAMP_SPIDER, OWNER_GA_ID, "OwnerPseudo"),
        ]
        session = mocker.AsyncMock()
        mocker.patch.object(
            DefensePlacementService, "get_defense", return_value=placements
        )

        result = await DefensePlacementService._report_snapshot(
            session, ALLIANCE_ID, BG
        )

        assert len(result) == 1
        item = result[0]
        assert isinstance(item, DefenseReportItem)
        assert item.champion_class == "Science"
        assert item.champion_image_url == "/champs/spider.png"
        assert item.champion_name == "Spider-Man"
        assert item.rarity == "7r3"
        assert item.node_number == 5
        assert item.owner_name == "OwnerPseudo"


# =========================================================================
# _import_one  (validation logic)
# =========================================================================


def _make_pseudo_map():
    """Return pseudo_map for a fake BG with owner + member."""
    owner = GameAccount(id=OWNER_GA_ID, user_id=uuid.uuid4(), game_pseudo="OwnerPseudo", is_primary=True)
    member = GameAccount(id=MEMBER_GA_ID, user_id=uuid.uuid4(), game_pseudo="MemberPseudo", is_primary=True)
    return {g.game_pseudo.lower(): g for g in [owner, member]}


def _make_champ_map():
    return {c.name.lower(): c for c in [CHAMP_SPIDER, CHAMP_WOLVERINE]}


class TestImportOne:
    """Unit tests for DefensePlacementService._import_one validation."""

    @pytest.mark.asyncio
    async def test_invalid_node_number(self, mocker):
        session = mocker.AsyncMock()
        item = DefenseExportItem(champion_name="X", rarity="7r3", node_number=0, owner_name="Y")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, {}, {}, None
        )
        assert reason is not None
        assert "Invalid node" in reason

    @pytest.mark.asyncio
    async def test_unknown_champion(self, mocker):
        session = mocker.AsyncMock()
        item = DefenseExportItem(champion_name="FakeChamp", rarity="7r3", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert "Unknown champion" in reason

    @pytest.mark.asyncio
    async def test_unknown_player(self, mocker):
        session = mocker.AsyncMock()
        item = DefenseExportItem(champion_name="Spider-Man", rarity="7r3", node_number=1, owner_name="GhostPlayer")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert "not found" in reason

    @pytest.mark.asyncio
    async def test_invalid_rarity_format(self, mocker):
        session = mocker.AsyncMock()
        item = DefenseExportItem(champion_name="Spider-Man", rarity="bad", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert "Invalid rarity" in reason

    @pytest.mark.asyncio
    async def test_champion_user_not_found_at_all(self, mocker):
        """Owner doesn't have this champion at any rarity."""
        session = mocker.AsyncMock()
        # First exec → no exact match, second exec → no fallback either
        mock_result_1 = mocker.MagicMock()
        mock_result_1.first.return_value = None
        mock_result_2 = mocker.MagicMock()
        mock_result_2.first.return_value = None
        session.exec = mocker.AsyncMock(side_effect=[mock_result_1, mock_result_2])

        item = DefenseExportItem(champion_name="Spider-Man", rarity="7r3", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert "does not own" in reason

    @pytest.mark.asyncio
    async def test_champion_user_wrong_rarity(self, mocker):
        """Owner has the champion but at a different rarity."""
        session = mocker.AsyncMock()
        # First exec → no exact match
        mock_result_1 = mocker.MagicMock()
        mock_result_1.first.return_value = None
        # Second exec → fallback found with different rarity
        fallback_cu = ChampionUser(
            id=uuid.uuid4(),
            game_account_id=OWNER_GA_ID,
            champion_id=CHAMP_SPIDER.id,
            stars=6,
            rank=4,
        )
        mock_result_2 = mocker.MagicMock()
        mock_result_2.first.return_value = fallback_cu
        session.exec = mocker.AsyncMock(side_effect=[mock_result_1, mock_result_2])

        item = DefenseExportItem(champion_name="Spider-Man", rarity="7r3", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert "6r4" in reason
        assert "not 7r3" in reason

    @pytest.mark.asyncio
    async def test_node_already_occupied(self, mocker):
        """Node is taken by a previous import entry."""
        session = mocker.AsyncMock()
        cu = ChampionUser(
            id=uuid.uuid4(),
            game_account_id=OWNER_GA_ID,
            champion_id=CHAMP_SPIDER.id,
            stars=7,
            rank=3,
        )
        # exec 1: exact match found
        mock_exact = mocker.MagicMock()
        mock_exact.first.return_value = cu
        # exec 2: node occupied
        mock_node = mocker.MagicMock()
        mock_node.first.return_value = object()  # truthy = occupied
        session.exec = mocker.AsyncMock(side_effect=[mock_exact, mock_node])

        item = DefenseExportItem(champion_name="Spider-Man", rarity="7r3", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert "already occupied" in reason

    @pytest.mark.asyncio
    async def test_duplicate_champion(self, mocker):
        """Champion already placed on another node."""
        session = mocker.AsyncMock()
        cu = ChampionUser(
            id=uuid.uuid4(),
            game_account_id=OWNER_GA_ID,
            champion_id=CHAMP_SPIDER.id,
            stars=7,
            rank=3,
        )
        # exec 1: exact match
        mock_exact = mocker.MagicMock()
        mock_exact.first.return_value = cu
        # exec 2: node free
        mock_node = mocker.MagicMock()
        mock_node.first.return_value = None
        # exec 3: champion dup found
        mock_dup = mocker.MagicMock()
        mock_dup.first.return_value = object()  # truthy = dup
        session.exec = mocker.AsyncMock(side_effect=[mock_exact, mock_node, mock_dup])

        item = DefenseExportItem(champion_name="Spider-Man", rarity="7r3", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert "already placed" in reason

    @pytest.mark.asyncio
    async def test_max_defenders_exceeded(self, mocker):
        """Player already has MAX defenders placed."""
        session = mocker.AsyncMock()
        cu = ChampionUser(
            id=uuid.uuid4(),
            game_account_id=OWNER_GA_ID,
            champion_id=CHAMP_SPIDER.id,
            stars=7,
            rank=3,
        )
        mock_exact = mocker.MagicMock()
        mock_exact.first.return_value = cu
        mock_node = mocker.MagicMock()
        mock_node.first.return_value = None
        mock_dup = mocker.MagicMock()
        mock_dup.first.return_value = None
        mock_count = mocker.MagicMock()
        mock_count.all.return_value = [object()] * MAX_DEFENDERS_PER_PLAYER  # at max
        session.exec = mocker.AsyncMock(side_effect=[mock_exact, mock_node, mock_dup, mock_count])

        item = DefenseExportItem(champion_name="Spider-Man", rarity="7r3", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is not None
        assert f"{MAX_DEFENDERS_PER_PLAYER} defenders" in reason

    @pytest.mark.asyncio
    async def test_successful_placement(self, mocker):
        """All checks pass → returns None (success) and adds placement to session."""
        session = mocker.AsyncMock()
        session.add = mocker.MagicMock()
        cu = ChampionUser(
            id=uuid.uuid4(),
            game_account_id=OWNER_GA_ID,
            champion_id=CHAMP_SPIDER.id,
            stars=7,
            rank=3,
        )
        mock_exact = mocker.MagicMock()
        mock_exact.first.return_value = cu
        mock_node = mocker.MagicMock()
        mock_node.first.return_value = None
        mock_dup = mocker.MagicMock()
        mock_dup.first.return_value = None
        mock_count = mocker.MagicMock()
        mock_count.all.return_value = []  # no existing defenders
        session.exec = mocker.AsyncMock(side_effect=[mock_exact, mock_node, mock_dup, mock_count])

        item = DefenseExportItem(champion_name="Spider-Man", rarity="7r3", node_number=1, owner_name="OwnerPseudo")
        reason = await DefensePlacementService._import_one(
            session, ALLIANCE_ID, BG, item, _make_pseudo_map(), _make_champ_map(), None
        )
        assert reason is None
        session.add.assert_called_once()
