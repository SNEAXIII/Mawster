import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from starlette import status

from src.enums.InvitationStatus import InvitationStatus
from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.models.AllianceInvitation import AllianceInvitation
from src.utils.db import SessionDep

MAX_MEMBERS_PER_ALLIANCE = 30


class AllianceInvitationService:
    @staticmethod
    async def _get_user_account_ids(session: SessionDep, user_id: uuid.UUID) -> set[uuid.UUID]:
        """Get the set of game account IDs belonging to a user."""
        result = await session.exec(
            select(GameAccount).where(GameAccount.user_id == user_id)
        )
        return {acc.id for acc in result.all()}

    @classmethod
    async def create_invitation(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
        invited_by_user_id: uuid.UUID,
        alliance: Alliance,
    ) -> AllianceInvitation:
        """Create an invitation for a game account to join an alliance."""
        # Check the game account exists
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account not found",
            )
        # Must not already be in an alliance
        if game_account.alliance_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This game account is already in an alliance",
            )
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
        # Check no pending invitation already exists for this game account + alliance
        existing = await session.exec(
            select(AllianceInvitation).where(
                AllianceInvitation.alliance_id == alliance_id,
                AllianceInvitation.game_account_id == game_account_id,
                AllianceInvitation.status == InvitationStatus.PENDING,
            )
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A pending invitation already exists for this game account in this alliance",
            )
        # Find the inviter's game account in this alliance
        inviter_accounts = await cls._get_user_account_ids(session, invited_by_user_id)
        # Pick the first account that belongs to the alliance
        inviter_ga_id = None
        for acc_id in inviter_accounts:
            ga = await session.get(GameAccount, acc_id)
            if ga and ga.alliance_id == alliance_id:
                inviter_ga_id = ga.id
                break
        if inviter_ga_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have a game account in this alliance",
            )
        invitation = AllianceInvitation(
            alliance_id=alliance_id,
            game_account_id=game_account_id,
            invited_by_game_account_id=inviter_ga_id,
        )
        session.add(invitation)
        await session.commit()
        await session.refresh(invitation)
        return invitation

    @classmethod
    async def get_invitations_for_user(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[AllianceInvitation]:
        """Get all pending invitations for game accounts owned by the user."""
        user_account_ids = await cls._get_user_account_ids(session, user_id)
        if not user_account_ids:
            return []
        result = await session.exec(
            select(AllianceInvitation)
            .where(
                AllianceInvitation.game_account_id.in_(user_account_ids),
                AllianceInvitation.status == InvitationStatus.PENDING,
            )
            .options(
                selectinload(AllianceInvitation.alliance),
                selectinload(AllianceInvitation.game_account),
                selectinload(AllianceInvitation.invited_by),
            )
        )
        return result.all()

    @classmethod
    async def get_invitations_for_alliance(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> list[AllianceInvitation]:
        """Get all pending invitations for an alliance."""
        result = await session.exec(
            select(AllianceInvitation)
            .where(
                AllianceInvitation.alliance_id == alliance_id,
                AllianceInvitation.status == InvitationStatus.PENDING,
            )
            .options(
                selectinload(AllianceInvitation.alliance),
                selectinload(AllianceInvitation.game_account),
                selectinload(AllianceInvitation.invited_by),
            )
        )
        return result.all()

    @classmethod
    async def accept_invitation(
        cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID
    ) -> AllianceInvitation:
        """Accept a pending invitation — the game account joins the alliance."""
        invitation = await session.get(AllianceInvitation, invitation_id)
        if invitation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found",
            )
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation is no longer pending",
            )
        # Verify the invitation target belongs to the current user
        user_account_ids = await cls._get_user_account_ids(session, user_id)
        if invitation.game_account_id not in user_account_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation is not for your game account",
            )
        game_account = await session.get(GameAccount, invitation.game_account_id)
        if game_account.alliance_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This game account is already in an alliance",
            )
        # Enforce member limit
        count_result = await session.exec(
            select(func.count(GameAccount.id)).where(
                GameAccount.alliance_id == invitation.alliance_id
            )
        )
        current_count = count_result.one()
        if current_count >= MAX_MEMBERS_PER_ALLIANCE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This alliance already has {MAX_MEMBERS_PER_ALLIANCE} members (maximum reached)",
            )
        # Join alliance
        game_account.alliance_id = invitation.alliance_id
        session.add(game_account)
        invitation.status = InvitationStatus.ACCEPTED
        invitation.responded_at = datetime.now()
        session.add(invitation)
        # Cancel all other pending invitations for this game account
        other_pending = await session.exec(
            select(AllianceInvitation).where(
                AllianceInvitation.game_account_id == invitation.game_account_id,
                AllianceInvitation.status == InvitationStatus.PENDING,
                AllianceInvitation.id != invitation.id,
            )
        )
        for other in other_pending.all():
            other.status = InvitationStatus.DECLINED
            other.responded_at = datetime.now()
            session.add(other)
        await session.commit()
        await session.refresh(invitation)
        return invitation

    @classmethod
    async def decline_invitation(
        cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID
    ) -> AllianceInvitation:
        """Decline a pending invitation."""
        invitation = await session.get(AllianceInvitation, invitation_id)
        if invitation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found",
            )
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation is no longer pending",
            )
        user_account_ids = await cls._get_user_account_ids(session, user_id)
        if invitation.game_account_id not in user_account_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation is not for your game account",
            )
        invitation.status = InvitationStatus.DECLINED
        invitation.responded_at = datetime.now()
        session.add(invitation)
        await session.commit()
        await session.refresh(invitation)
        return invitation

    @classmethod
    async def cancel_invitation(
        cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID, alliance: Alliance
    ) -> AllianceInvitation:
        """Cancel a pending invitation (by the alliance owner/officer who sent it)."""
        invitation = await session.get(AllianceInvitation, invitation_id)
        if invitation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found",
            )
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation is no longer pending",
            )
        if invitation.alliance_id != alliance.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation does not belong to this alliance",
            )
        await session.delete(invitation)
        await session.commit()
        return invitation
