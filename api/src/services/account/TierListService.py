import uuid

from sqlalchemy import delete, func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.account.dto_tierlist import (
    TierListDetailResponse,
    TierListSaveRequest,
    TierListSummaryResponse,
    TierListTagResponse,
    TierListTierResponse,
)
from src.models import Champion
from src.models.tierlist.TierList import TierList
from src.models.tierlist.TierListChampionTag import TierListChampionTag
from src.models.tierlist.TierListRanking import TierListRanking
from src.models.tierlist.TierListTier import TierListTier

# How many tier lists one account may hold. Arbitrary, like the ten players an account
# may bind: a ceiling against abuse, not a game rule.
MAX_TIER_LISTS_PER_USER = 20


class TierListService:
    """Tier lists, owned by an account.

    Every write replaces the list whole — the front sends the board back complete after
    each change rather than describing what moved.
    """

    @classmethod
    async def list_for_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[TierListSummaryResponse]:
        """The account's tier lists, oldest first, without loading their contents."""
        tier_lists = (
            await session.exec(
                select(TierList).where(TierList.user_id == user_id).order_by(TierList.created_at)
            )
        ).all()
        if not tier_lists:
            return []
        # Two grouped queries, not two per list: twenty lists would otherwise mean forty
        # round trips to draw a picker that shows no contents.
        ids = [tier_list.id for tier_list in tier_lists]
        tier_counts = await cls._count_by_tierlist(session, TierListTier, ids)
        ranked_counts = await cls._count_by_tierlist(session, TierListRanking, ids)
        return [
            TierListSummaryResponse(
                id=tier_list.id,
                title=tier_list.title,
                created_at=tier_list.created_at,
                tier_count=tier_counts.get(tier_list.id, 0),
                ranked_champion_count=ranked_counts.get(tier_list.id, 0),
            )
            for tier_list in tier_lists
        ]

    @staticmethod
    async def _count_by_tierlist(
        session: AsyncSession,
        model: type[TierListTier] | type[TierListRanking],
        tierlist_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, int]:
        """How many rows of ``model`` each of those tier lists holds."""
        rows = (
            await session.exec(
                select(model.tierlist_id, func.count(model.id))
                .where(model.tierlist_id.in_(tierlist_ids))
                .group_by(model.tierlist_id)
            )
        ).all()
        return dict(rows)

    @classmethod
    async def count_for_user(cls, session: AsyncSession, user_id: uuid.UUID) -> int:
        return (
            await session.exec(select(func.count(TierList.id)).where(TierList.user_id == user_id))
        ).one()

    @classmethod
    async def get_owned(
        cls, session: AsyncSession, tierlist_id: uuid.UUID, user_id: uuid.UUID
    ) -> TierList | None:
        """The tier list, only if this account owns it. Anything else reads as absent."""
        return (
            await session.exec(
                select(TierList).where(TierList.id == tierlist_id, TierList.user_id == user_id)
            )
        ).first()

    @classmethod
    async def find_unknown_champions(
        cls, session: AsyncSession, body: TierListSaveRequest
    ) -> list[uuid.UUID]:
        """Champion ids the request names that the catalog does not hold.

        Checked before writing: a champion deleted from the catalog since the board was
        loaded would otherwise surface as a foreign-key error, i.e. a 500.
        """
        referenced = {champion_id for tier in body.tiers for champion_id in tier.champion_ids} | {
            tag.champion_id for tag in body.tags
        }
        if not referenced:
            return []
        known = set(
            (await session.exec(select(Champion.id).where(Champion.id.in_(referenced)))).all()
        )
        return sorted(referenced - known)

    @classmethod
    async def create(
        cls, session: AsyncSession, user_id: uuid.UUID, body: TierListSaveRequest
    ) -> TierList:
        tier_list = TierList(user_id=user_id, title=body.title)
        session.add(tier_list)
        await session.flush()
        await cls._write_contents(session, tier_list, body)
        await session.commit()
        await session.refresh(tier_list)
        return tier_list

    @classmethod
    async def replace(
        cls, session: AsyncSession, tier_list: TierList, body: TierListSaveRequest
    ) -> TierList:
        """Overwrite the whole list: rows, rankings and tags all go and come back."""
        tier_list.title = body.title
        session.add(tier_list)
        await cls._clear_contents(session, tier_list.id)
        await cls._write_contents(session, tier_list, body)
        await session.commit()
        await session.refresh(tier_list)
        return tier_list

    @classmethod
    async def delete(cls, session: AsyncSession, tier_list: TierList) -> None:
        await cls._clear_contents(session, tier_list.id)
        await session.delete(tier_list)
        await session.commit()

    @classmethod
    async def to_detail(cls, session: AsyncSession, tier_list: TierList) -> TierListDetailResponse:
        tiers = (
            await session.exec(
                select(TierListTier)
                .where(TierListTier.tierlist_id == tier_list.id)
                .order_by(TierListTier.position)
            )
        ).all()
        rankings = (
            await session.exec(
                select(TierListRanking)
                .where(TierListRanking.tierlist_id == tier_list.id)
                .order_by(TierListRanking.position)
            )
        ).all()
        tags = (
            await session.exec(
                select(TierListChampionTag).where(TierListChampionTag.tierlist_id == tier_list.id)
            )
        ).all()
        ranked_by_tier: dict[uuid.UUID, list[uuid.UUID]] = {tier.id: [] for tier in tiers}
        for ranking in rankings:
            ranked_by_tier.setdefault(ranking.tier_id, []).append(ranking.champion_id)
        return TierListDetailResponse(
            id=tier_list.id,
            title=tier_list.title,
            created_at=tier_list.created_at,
            tiers=[
                TierListTierResponse(
                    id=tier.id,
                    label=tier.label,
                    color=tier.color,
                    position=tier.position,
                    champion_ids=ranked_by_tier.get(tier.id, []),
                )
                for tier in tiers
            ],
            tags=[TierListTagResponse.model_validate(tag) for tag in tags],
        )

    @staticmethod
    async def _clear_contents(session: AsyncSession, tierlist_id: uuid.UUID) -> None:
        """Empty the list without touching the row itself.

        Rankings go first and by hand: SQLite (the integration tests) only enforces the
        cascade with a pragma the session does not set, so relying on it would pass on
        MariaDB and leave orphans in the tests.
        """
        await session.exec(
            delete(TierListRanking).where(TierListRanking.tierlist_id == tierlist_id)
        )
        await session.exec(delete(TierListTier).where(TierListTier.tierlist_id == tierlist_id))
        await session.exec(
            delete(TierListChampionTag).where(TierListChampionTag.tierlist_id == tierlist_id)
        )

    @staticmethod
    async def _write_contents(
        session: AsyncSession, tier_list: TierList, body: TierListSaveRequest
    ) -> None:
        """Insert the rows, their rankings and the tags, ordered as the request lists them."""
        for tier_position, tier_payload in enumerate(body.tiers):
            tier = TierListTier(
                tierlist_id=tier_list.id,
                label=tier_payload.label,
                color=tier_payload.color,
                position=tier_position,
            )
            session.add(tier)
            await session.flush()
            for ranking_position, champion_id in enumerate(tier_payload.champion_ids):
                session.add(
                    TierListRanking(
                        tierlist_id=tier_list.id,
                        tier_id=tier.id,
                        champion_id=champion_id,
                        position=ranking_position,
                    )
                )
        for tag_payload in body.tags:
            session.add(
                TierListChampionTag(
                    tierlist_id=tier_list.id,
                    **tag_payload.model_dump(),
                )
            )
