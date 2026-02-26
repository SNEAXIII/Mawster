import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from starlette import status

from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.models.AllianceOfficer import AllianceOfficer
from src.utils.db import SessionDep

MAX_MEMBERS_PER_GROUP = 10
MAX_MEMBERS_PER_ALLIANCE = 30


class AllianceService:
    @staticmethod
    async def _get_user_account_ids(session: SessionDep, user_id: uuid.UUID) -> set[uuid.UUID]:
        """Get the set of game account IDs belonging to a user."""
        result = await session.exec(
            select(GameAccount).where(GameAccount.user_id == user_id)
        )
        return {acc.id for acc in result.all()}

    @staticmethod
    def _assert_not_in_alliance(game_account: GameAccount) -> None:
        """Raise 409 if the game account is already in an alliance."""
        if game_account.alliance_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This game account is already in an alliance",
            )

    @staticmethod
    def _assert_is_alliance_member(
        game_account: Optional[GameAccount], alliance_id: uuid.UUID
    ) -> None:
        """Raise 404 if the game account is None or not a member of the given alliance."""
        if game_account is None or game_account.alliance_id != alliance_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account is not a member of this alliance",
            )

    @classmethod
    async def _load_alliance_with_relations(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> Optional[Alliance]:
        """Load an alliance with owner, members and officers eagerly loaded."""
        sql = (
            select(Alliance)
            .where(Alliance.id == alliance_id)
            .options(
                selectinload(Alliance.owner),  # type: ignore[arg-type]
                selectinload(Alliance.members),  # type: ignore[arg-type]
                selectinload(Alliance.officers).selectinload(AllianceOfficer.game_account),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(sql)
        return result.first()

    @classmethod
    async def _assert_is_owner_or_officer(
        cls, session: SessionDep, alliance: Alliance, current_user_id: uuid.UUID
    ) -> None:
        """Check that current_user owns at least one game account that is owner or officer of the alliance."""
        user_account_ids = await cls._get_user_account_ids(session, current_user_id)

        # Check owner
        if alliance.owner_id in user_account_ids:
            return

        # Check officers
        officer_ids = {off.game_account_id for off in alliance.officers}
        if user_account_ids & officer_ids:
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the alliance owner or an officer can perform this action",
        )

    @classmethod
    async def _assert_is_owner(
        cls, session: SessionDep, alliance: Alliance, current_user_id: uuid.UUID
    ) -> None:
        """Check that the current user owns a game account that is the alliance owner."""
        user_account_ids = await cls._get_user_account_ids(session, current_user_id)
        if alliance.owner_id not in user_account_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the alliance owner can perform this action",
            )

    @classmethod
    async def _assert_can_remove_member(
        cls, session: SessionDep, alliance: Alliance, current_user_id: uuid.UUID, target_game_account_id: uuid.UUID
    ) -> None:
        """Check that the current user can remove the target member.
        - The owner can remove anyone (except themselves, handled elsewhere).
        - An officer can remove regular members but NOT other officers."""
        user_account_ids = await cls._get_user_account_ids(session, current_user_id)

        # Owner can remove anyone
        if alliance.owner_id in user_account_ids:
            return

        # Check if caller is officer
        officer_ids = {off.game_account_id for off in alliance.officers}
        if not (user_account_ids & officer_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the alliance owner or an officer can perform this action",
            )

        # Caller is officer — cannot remove another officer
        if target_game_account_id in officer_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An officer cannot remove another officer",
            )

    @classmethod
    async def create_alliance(
        cls,
        session: SessionDep,
        name: str,
        tag: str,
        owner_id: uuid.UUID,
        current_user_id: uuid.UUID,
    ) -> Alliance:
        """Create a new alliance. The owner game account must belong to the current user
        and must not already be in an alliance."""
        owner = await session.get(GameAccount, owner_id)
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owner game account not found",
            )
        # Verify the game account belongs to the current user
        if owner.user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This game account does not belong to you",
            )
        # A player can only belong to one alliance at a time
        cls._assert_not_in_alliance(owner)
        alliance = Alliance(
            name=name,
            tag=tag,
            owner_id=owner_id,
        )
        session.add(alliance)
        await session.flush()  # get alliance.id

        # The owner automatically becomes a member of the alliance
        owner.alliance_id = alliance.id
        session.add(owner)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance.id)

    @classmethod
    async def get_alliance(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> Optional[Alliance]:
        return await cls._load_alliance_with_relations(session, alliance_id)

    @classmethod
    async def get_all_alliances(
        cls, session: SessionDep
    ) -> list[Alliance]:
        sql = (
            select(Alliance)
            .options(
                selectinload(Alliance.owner),  # type: ignore[arg-type]
                selectinload(Alliance.members),  # type: ignore[arg-type]
                selectinload(Alliance.officers).selectinload(AllianceOfficer.game_account),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_my_alliances(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[Alliance]:
        """Return only alliances where the user has at least one game account as member."""
        user_accounts = await session.exec(
            select(GameAccount.alliance_id)
            .where(GameAccount.user_id == user_id)
            .where(GameAccount.alliance_id.isnot(None))  # type: ignore[union-attr]
        )
        alliance_ids = {aid for aid in user_accounts.all() if aid is not None}
        if not alliance_ids:
            return []
        sql = (
            select(Alliance)
            .where(Alliance.id.in_(alliance_ids))  # type: ignore[union-attr]
            .options(
                selectinload(Alliance.owner),  # type: ignore[arg-type]
                selectinload(Alliance.members),  # type: ignore[arg-type]
                selectinload(Alliance.officers).selectinload(AllianceOfficer.game_account),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_my_roles(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> dict:
        """Return alliance role information for the current user.

        Returns a dict with:
          - roles: { alliance_id_str: { is_owner, is_officer, can_manage } }
          - my_account_ids: [ str(account_id), ... ]
        """
        # 1. Get all game accounts for this user
        accs_result = await session.exec(
            select(GameAccount).where(GameAccount.user_id == user_id)
        )
        user_accounts = accs_result.all()
        user_account_ids = {acc.id for acc in user_accounts}
        my_account_ids = [str(aid) for aid in user_account_ids]

        # 2. Get alliance IDs the user is a member of
        alliance_ids = {acc.alliance_id for acc in user_accounts if acc.alliance_id is not None}
        if not alliance_ids:
            return {"roles": {}, "my_account_ids": my_account_ids}

        # 3. Load those alliances with officers
        sql = (
            select(Alliance)
            .where(Alliance.id.in_(alliance_ids))  # type: ignore[union-attr]
            .options(
                selectinload(Alliance.officers),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(sql)
        alliances = result.all()

        # 4. Build role map
        roles: dict[str, dict] = {}
        for alliance in alliances:
            is_owner = alliance.owner_id in user_account_ids
            officer_ids = {off.game_account_id for off in alliance.officers}
            is_officer = bool(user_account_ids & officer_ids)
            can_manage = is_owner or is_officer
            roles[str(alliance.id)] = {
                "is_owner": is_owner,
                "is_officer": is_officer,
                "can_manage": can_manage,
            }

        return {"roles": roles, "my_account_ids": my_account_ids}

    @classmethod
    async def update_alliance(
        cls,
        session: SessionDep,
        alliance: Alliance,
        name: str,
        tag: str,
    ) -> Alliance:
        alliance.name = name
        alliance.tag = tag
        session.add(alliance)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance.id)

    @classmethod
    async def delete_alliance(
        cls, session: SessionDep, alliance: Alliance
    ) -> None:
        # Remove all members from the alliance first
        members_result = await session.exec(
            select(GameAccount).where(GameAccount.alliance_id == alliance.id)
        )
        for member in members_result.all():
            member.alliance_id = None
            member.alliance_group = None
            session.add(member)

        # Remove all officers
        officers_result = await session.exec(
            select(AllianceOfficer).where(AllianceOfficer.alliance_id == alliance.id)
        )
        for off in officers_result.all():
            await session.delete(off)

        await session.delete(alliance)
        await session.commit()

    # ---- Member management ----

    @classmethod
    async def add_member(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> Alliance:
        """Add a game account as a member of the alliance.
        The game account must not already be in any alliance.
        The alliance must not exceed MAX_MEMBERS_PER_ALLIANCE."""
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account not found",
            )
        cls._assert_not_in_alliance(game_account)
        # Enforce member limit
        count_result = await session.exec(
            select(func.count(GameAccount.id)).where(
                GameAccount.alliance_id == alliance_id
            )
        )
        current_count = count_result.one()
        if current_count >= MAX_MEMBERS_PER_ALLIANCE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This alliance already has {MAX_MEMBERS_PER_ALLIANCE} members (maximum reached)",
            )
        game_account.alliance_id = alliance_id
        session.add(game_account)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance_id)

    @classmethod
    async def remove_member(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> Alliance:
        """Remove a member from the alliance. Cannot remove the owner."""
        alliance = await cls._load_alliance_with_relations(session, alliance_id)
        if alliance is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alliance not found",
            )
        if alliance.owner_id == game_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the owner from the alliance",
            )
        game_account = await session.get(GameAccount, game_account_id)
        cls._assert_is_alliance_member(game_account, alliance_id)
        # Also remove officer status if applicable
        officer_result = await session.exec(
            select(AllianceOfficer).where(
                AllianceOfficer.alliance_id == alliance_id,
                AllianceOfficer.game_account_id == game_account_id,
            )
        )
        officer = officer_result.first()
        if officer:
            await session.delete(officer)

        game_account.alliance_id = None
        game_account.alliance_group = None
        session.add(game_account)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance_id)

    # ---- Officer management ----

    @classmethod
    async def add_adjoint(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> Alliance:
        """Add a game account as adjoint of the alliance.
        The game account MUST already be a member of the alliance."""
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account not found",
            )
        # Adjoint must be a member of the alliance
        if game_account.alliance_id != alliance_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Game account must be a member of the alliance to become an officer",
            )
        # Check not already adjoint
        existing = await session.exec(
            select(AllianceOfficer).where(
                AllianceOfficer.alliance_id == alliance_id,
                AllianceOfficer.game_account_id == game_account_id,
            )
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Game account is already an adjoint of this alliance",
            )
        adjoint = AllianceOfficer(
            alliance_id=alliance_id,
            game_account_id=game_account_id,
        )
        session.add(adjoint)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance_id)

    @classmethod
    async def remove_adjoint(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> Alliance:
        """Remove a game account from the alliance's officers."""
        result = await session.exec(
            select(AllianceOfficer).where(
                AllianceOfficer.alliance_id == alliance_id,
                AllianceOfficer.game_account_id == game_account_id,
            )
        )
        adjoint = result.first()
        if adjoint is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="This game account is not an adjoint of this alliance",
            )
        await session.delete(adjoint)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance_id)

    # ---- Group management ----

    @classmethod
    async def set_member_group(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
        group: Optional[int],
    ) -> Alliance:
        """Set the group (1, 2, 3 or None) for a member. Max 10 members per group."""
        game_account = await session.get(GameAccount, game_account_id)
        cls._assert_is_alliance_member(game_account, alliance_id)
        if group is not None:
            if group not in (1, 2, 3):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Group must be 1, 2, 3 or null",
                )
            # Count current members in this group (excluding the target account)
            count_result = await session.exec(
                select(func.count(GameAccount.id)).where(
                    GameAccount.alliance_id == alliance_id,
                    GameAccount.alliance_group == group,
                    GameAccount.id != game_account_id,
                )
            )
            current_count = count_result.one()
            if current_count >= MAX_MEMBERS_PER_GROUP:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Group {group} already has {MAX_MEMBERS_PER_GROUP} members (maximum reached)",
                )
        game_account.alliance_group = group
        session.add(game_account)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance_id)

    # ---- Eligibility queries ----

    @classmethod
    async def get_eligible_owners(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[GameAccount]:
        """Get game accounts of the user that are NOT already in an alliance (eligible to create one)."""
        sql = select(GameAccount).where(
            GameAccount.user_id == user_id,
            GameAccount.alliance_id == None,  # noqa: E711
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_eligible_officers(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> list[GameAccount]:
        """Get members of the alliance who are not the owner and not already officers."""
        alliance = await cls._load_alliance_with_relations(session, alliance_id)
        if alliance is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alliance not found",
            )
        officer_ids = {off.game_account_id for off in alliance.officers}
        return [
            m for m in alliance.members
            if m.id != alliance.owner_id and m.id not in officer_ids
        ]

    @classmethod
    async def get_eligible_members(
        cls, session: SessionDep
    ) -> list[GameAccount]:
        """Get all game accounts that are NOT in any alliance (can be invited)."""
        sql = select(GameAccount).where(
            GameAccount.alliance_id == None,  # noqa: E711
        )
        result = await session.exec(sql)
        return result.all()
