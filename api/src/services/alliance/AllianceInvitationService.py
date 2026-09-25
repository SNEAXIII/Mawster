import uuid

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import or_, select
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
)
from src.Messages.visitor_messages import ALREADY_A_VISITOR, alliance_max_visitors_reached
from src.models.alliance.Alliance import Alliance
from src.models.alliance.AllianceInvitation import AllianceInvitation
from src.models.alliance.AllianceVisitor import AllianceVisitor
from src.models.Base import utcnow
from src.models.user.GameAccount import GameAccount
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.AllianceVisitorService import (
    MAX_VISITORS_PER_ALLIANCE,
    AllianceVisitorService,
)
from src.utils.db import SessionDep

_INVITATION_OPTIONS = (
    selectinload(AllianceInvitation.alliance),
    selectinload(AllianceInvitation.game_account),
    selectinload(AllianceInvitation.invited_by),
)


class AllianceInvitationService:
    @staticmethod
    async def _assert_can_become_visitor(
        session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> None:
        """Raise 409 if the game account is already a visitor or the alliance is full."""
        if await AllianceVisitorService.is_visitor(session, alliance_id, game_account_id):
            raise HTTPException(status.HTTP_409_CONFLICT, ALREADY_A_VISITOR)
        if (
            await AllianceVisitorService.count_visitors(session, alliance_id)
            >= MAX_VISITORS_PER_ALLIANCE
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, alliance_max_visitors_reached(MAX_VISITORS_PER_ALLIANCE)
            )

    @staticmethod
    async def _pending(session: SessionDep, invitation_id: uuid.UUID) -> AllianceInvitation:
        invitation = await session.get(AllianceInvitation, invitation_id)
        if invitation is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, INVITATION_NOT_FOUND)
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, INVITATION_NO_LONGER_PENDING)
        return invitation

    @classmethod
    async def _pending_for_user(
        cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID
    ) -> AllianceInvitation:
        """The pending invitation, provided it targets one of the user's live accounts."""
        invitation = await cls._pending(session, invitation_id)
        accounts = await AllianceService._get_user_accounts(session, user_id)
        if invitation.game_account_id not in {a.id for a in accounts}:
            raise HTTPException(status.HTTP_403_FORBIDDEN, INVITATION_NOT_FOR_YOUR_GAME_ACCOUNT)
        return invitation

    @staticmethod
    async def _respond(
        session: SessionDep, invitation: AllianceInvitation, new_status: InvitationStatus
    ) -> AllianceInvitation:
        invitation.status = new_status
        invitation.responded_at = utcnow()
        session.add(invitation)
        await session.commit()
        await session.refresh(invitation)
        return invitation

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
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None or game_account.deleted_at is not None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, GAME_ACCOUNT_NOT_FOUND)

        if invitation_type == InvitationType.MEMBER:
            if game_account.alliance_id is not None:
                raise HTTPException(status.HTTP_409_CONFLICT, GAME_ACCOUNT_ALREADY_IN_ALLIANCE)
            await AllianceService.assert_room_for_member(session, alliance_id)
        else:
            await cls._assert_can_become_visitor(session, alliance_id, game_account_id)

        existing = await session.exec(
            select(AllianceInvitation).where(
                AllianceInvitation.alliance_id == alliance_id,
                AllianceInvitation.game_account_id == game_account_id,
                AllianceInvitation.status == InvitationStatus.PENDING,
                AllianceInvitation.type == invitation_type,
            )
        )
        if existing.first() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, PENDING_INVITATION_ALREADY_EXISTS)
        inviter_accounts = await AllianceService._get_user_accounts(session, invited_by_user_id)
        inviter = next((a for a in inviter_accounts if a.alliance_id == alliance_id), None)
        if inviter is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, INVITER_NOT_IN_ALLIANCE)
        invitation = AllianceInvitation(
            alliance_id=alliance_id,
            game_account_id=game_account_id,
            invited_by_game_account_id=inviter.id,
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
        """Get all pending invitations for live game accounts owned by the user."""
        result = await session.exec(
            select(AllianceInvitation)
            .join(GameAccount, AllianceInvitation.game_account_id == GameAccount.id)
            .where(
                GameAccount.user_id == user_id,
                GameAccount.deleted_at.is_(None),
                AllianceInvitation.status == InvitationStatus.PENDING,
            )
            .options(*_INVITATION_OPTIONS)
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
            .options(*_INVITATION_OPTIONS)
        )
        return result.all()

    @classmethod
    async def accept_invitation(
        cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID
    ) -> AllianceInvitation:
        """Accept a pending invitation. MEMBER: join alliance. VISITOR: create AllianceVisitor record."""
        invitation = await cls._pending_for_user(session, invitation_id, user_id)

        if invitation.type == InvitationType.VISITOR:
            await cls._assert_can_become_visitor(
                session, invitation.alliance_id, invitation.game_account_id
            )
            session.add(
                AllianceVisitor(
                    alliance_id=invitation.alliance_id, game_account_id=invitation.game_account_id
                )
            )
            return await cls._respond(session, invitation, InvitationStatus.ACCEPTED)

        game_account = await session.get(GameAccount, invitation.game_account_id)
        if game_account.alliance_id is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, GAME_ACCOUNT_ALREADY_IN_ALLIANCE)
        await AllianceService.assert_room_for_member(session, invitation.alliance_id)
        await AllianceVisitorService.remove_if_visitor(
            session, invitation.alliance_id, invitation.game_account_id
        )
        game_account.alliance_id = invitation.alliance_id

        other_pending = await session.exec(
            select(AllianceInvitation).where(
                AllianceInvitation.game_account_id == invitation.game_account_id,
                AllianceInvitation.status == InvitationStatus.PENDING,
                AllianceInvitation.id != invitation.id,
                AllianceInvitation.type == InvitationType.MEMBER,
            )
        )
        now = utcnow()
        for other in other_pending.all():
            other.status = InvitationStatus.DECLINED
            other.responded_at = now
        return await cls._respond(session, invitation, InvitationStatus.ACCEPTED)

    @classmethod
    async def decline_invitation(
        cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID
    ) -> AllianceInvitation:
        """Decline a pending invitation."""
        invitation = await cls._pending_for_user(session, invitation_id, user_id)
        return await cls._respond(session, invitation, InvitationStatus.DECLINED)

    @classmethod
    async def cancel_pending_for_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> None:
        """Drop every pending invitation a game account received or sent.

        Called when the account goes away: an invitation nobody can answer any
        more would sit pending forever and keep blocking a fresh invite.
        """
        result = await session.exec(
            select(AllianceInvitation).where(
                AllianceInvitation.status == InvitationStatus.PENDING,
                or_(
                    AllianceInvitation.game_account_id == game_account_id,
                    AllianceInvitation.invited_by_game_account_id == game_account_id,
                ),
            )
        )
        for invitation in result.all():
            await session.delete(invitation)

    @classmethod
    async def cancel_invitation(
        cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID, alliance: Alliance
    ) -> AllianceInvitation:
        """Cancel a pending invitation (by the alliance owner/officer who sent it)."""
        invitation = await cls._pending(session, invitation_id)
        if invitation.alliance_id != alliance.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, INVITATION_NOT_IN_THIS_ALLIANCE)
        await session.delete(invitation)
        await session.commit()
        return invitation
