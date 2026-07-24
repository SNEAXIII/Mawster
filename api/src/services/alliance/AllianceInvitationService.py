import uuid

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import select
from starlette import status

from src.enums.InvitationStatus import InvitationStatus
from src.enums.InvitationType import InvitationType
from src.Messages.invitation_messages import (
    GAME_ACCOUNT_ALREADY_IN_ALLIANCE,
    GAME_ACCOUNT_NOT_FOUND,
    INVITATION_NO_LONGER_PENDING,
    INVITATION_NOT_FOR_YOUR_GAME_ACCOUNT,
    INVITATION_NOT_FOUND,
    INVITATION_NOT_IN_THIS_ALLIANCE,
    INVITER_NOT_IN_ALLIANCE,
    PENDING_INVITATION_ALREADY_EXISTS,
    alliance_max_members_reached,
)
from src.Messages.visitor_messages import ALREADY_A_VISITOR, alliance_max_visitors_reached
from src.models.Alliance import Alliance
from src.models.AllianceInvitation import AllianceInvitation
from src.models.Base import utcnow
from src.models.GameAccount import GameAccount
from src.services.alliance.AllianceVisitorService import (
    MAX_VISITORS_PER_ALLIANCE,
    AllianceVisitorService,
)
from src.utils.db import SessionDep

MAX_MEMBERS_PER_ALLIANCE = 30


class AllianceInvitationService:
    @staticmethod
    async def _get_user_account_ids(session: SessionDep, user_id: uuid.UUID) -> set[uuid.UUID]:
        """Get the set of game account IDs belonging to a user."""
        result = await session.exec(select(GameAccount).where(GameAccount.user_id == user_id))
        return {acc.id for acc in result.all()}

    @staticmethod
    async def _assert_can_become_visitor(
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> None:
        """Raise 409 if the game account is already a visitor or the alliance is full."""

        already_visitor = await AllianceVisitorService.is_visitor(
            session, alliance_id, game_account_id
        )
        if already_visitor:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALREADY_A_VISITOR)
        visitor_count = await AllianceVisitorService.count_visitors(session, alliance_id)
        if visitor_count >= MAX_VISITORS_PER_ALLIANCE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=alliance_max_visitors_reached(MAX_VISITORS_PER_ALLIANCE),
            )

    @classmethod
    async def create_invitation(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
        invited_by_user_id: uuid.UUID,
        alliance: Alliance,
        invitation_type: InvitationType = InvitationType.MEMBER,
    ) -> AllianceInvitation:
        """Create an invitation for a game account to join (MEMBER) or visit (VISITOR) an alliance."""
        # Check the game account exists
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=GAME_ACCOUNT_NOT_FOUND,
            )

        if invitation_type == InvitationType.MEMBER:
            # Must not already be in an alliance
            if game_account.alliance_id is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=GAME_ACCOUNT_ALREADY_IN_ALLIANCE,
                )
            # Enforce member limit
            count_result = await session.exec(
                select(func.count(GameAccount.id)).where(GameAccount.alliance_id == alliance_id)
            )
            if count_result.one() >= MAX_MEMBERS_PER_ALLIANCE:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=alliance_max_members_reached(MAX_MEMBERS_PER_ALLIANCE),
                )
        else:
            await cls._assert_can_become_visitor(session, alliance_id, game_account_id)

        # Check no pending invitation already exists for this game account + alliance + type
        existing = await session.exec(
            select(AllianceInvitation).where(
                AllianceInvitation.alliance_id == alliance_id,
                AllianceInvitation.game_account_id == game_account_id,
                AllianceInvitation.status == InvitationStatus.PENDING,
                AllianceInvitation.type == invitation_type,
            )
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=PENDING_INVITATION_ALREADY_EXISTS,
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
                detail=INVITER_NOT_IN_ALLIANCE,
            )
        invitation = AllianceInvitation(
            alliance_id=alliance_id,
            game_account_id=game_account_id,
            invited_by_game_account_id=inviter_ga_id,
            type=invitation_type,
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
        """Accept a pending invitation. MEMBER: join alliance. VISITOR: create AllianceVisitor record."""
        from src.models.AllianceVisitor import AllianceVisitor as AV

        invitation = await session.get(AllianceInvitation, invitation_id)
        if invitation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=INVITATION_NOT_FOUND,
            )
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVITATION_NO_LONGER_PENDING,
            )
        # Verify the invitation target belongs to the current user
        user_account_ids = await cls._get_user_account_ids(session, user_id)
        if invitation.game_account_id not in user_account_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=INVITATION_NOT_FOR_YOUR_GAME_ACCOUNT,
            )

        if invitation.type == InvitationType.VISITOR:
            await cls._assert_can_become_visitor(
                session, invitation.alliance_id, invitation.game_account_id
            )
            visitor = AV(
                alliance_id=invitation.alliance_id,
                game_account_id=invitation.game_account_id,
            )
            session.add(visitor)
            invitation.status = InvitationStatus.ACCEPTED
            invitation.responded_at = utcnow()
            session.add(invitation)
            await session.commit()
            await session.refresh(invitation)
            return invitation

        # MEMBER flow
        game_account = await session.get(GameAccount, invitation.game_account_id)
        if game_account.alliance_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=GAME_ACCOUNT_ALREADY_IN_ALLIANCE,
            )
        # Enforce member limit
        count_result = await session.exec(
            select(func.count(GameAccount.id)).where(
                GameAccount.alliance_id == invitation.alliance_id
            )
        )
        if count_result.one() >= MAX_MEMBERS_PER_ALLIANCE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=alliance_max_members_reached(MAX_MEMBERS_PER_ALLIANCE),
            )
        # Clean up any visitor record for this game account in this alliance
        from src.services.alliance.AllianceVisitorService import AllianceVisitorService

        await AllianceVisitorService.remove_if_visitor(
            session, invitation.alliance_id, invitation.game_account_id
        )
        # Join alliance
        game_account.alliance_id = invitation.alliance_id
        session.add(game_account)
        invitation.status = InvitationStatus.ACCEPTED
        invitation.responded_at = utcnow()
        session.add(invitation)
        # Cancel other pending MEMBER invitations for this game account
        other_pending = await session.exec(
            select(AllianceInvitation).where(
                AllianceInvitation.game_account_id == invitation.game_account_id,
                AllianceInvitation.status == InvitationStatus.PENDING,
                AllianceInvitation.id != invitation.id,
                AllianceInvitation.type == InvitationType.MEMBER,
            )
        )
        for other in other_pending.all():
            other.status = InvitationStatus.DECLINED
            other.responded_at = utcnow()
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
                detail=INVITATION_NOT_FOUND,
            )
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVITATION_NO_LONGER_PENDING,
            )
        user_account_ids = await cls._get_user_account_ids(session, user_id)
        if invitation.game_account_id not in user_account_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=INVITATION_NOT_FOR_YOUR_GAME_ACCOUNT,
            )
        invitation.status = InvitationStatus.DECLINED
        invitation.responded_at = utcnow()
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
                detail=INVITATION_NOT_FOUND,
            )
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVITATION_NO_LONGER_PENDING,
            )
        if invitation.alliance_id != alliance.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=INVITATION_NOT_IN_THIS_ALLIANCE,
            )
        await session.delete(invitation)
        await session.commit()
        return invitation
