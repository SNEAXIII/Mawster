import uuid

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.dto.account.game.dto_upgrade_request import UpgradeRequestResponse
from src.dto.alliance.defense.dto_defense_plan import DefensePlanNodeResponse
from src.dto.alliance.dto_invitation import AllianceInvitationResponse
from src.dto.player.dto_player_dashboard import (
    PlayerDashboardAlliance,
    PlayerDashboardResponse,
    PlayerDashboardWar,
)
from src.enums.WarStatus import WarStatus
from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND
from src.models.user.GameAccount import GameAccount
from src.models.war.War import War
from src.services.account.game.GameAccountService import GameAccountService
from src.services.admin.SeasonService import SeasonService
from src.services.alliance.AllianceInvitationService import AllianceInvitationService
from src.services.alliance.defense.DefensePlanService import DefensePlanService
from src.services.alliance.defense.presenters import plan_response
from src.services.alliance.UpgradeRequestService import UpgradeRequestService
from src.services.alliance.war.WarService import WarService
from src.utils.db import SessionDep


class PlayerDashboardService:
    @classmethod
    async def get_dashboard(
        cls, session: SessionDep, user_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> PlayerDashboardResponse:
        player = await GameAccountService.get_game_account(session, game_account_id)
        if player is None or player.user_id != user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, GAME_ACCOUNT_NOT_FOUND)

        invitations = await AllianceInvitationService.get_invitations_for_user(
            session, user_id, game_account_id=player.id
        )
        upgrades = await UpgradeRequestService.get_pending_by_game_account(session, player.id)
        dashboard = PlayerDashboardResponse(
            invitations=[AllianceInvitationResponse.model_validate(i) for i in invitations],
            upgrade_requests=[UpgradeRequestResponse.model_validate(u) for u in upgrades],
        )
        if player.alliance_id is None:
            return dashboard

        dashboard.alliance = PlayerDashboardAlliance(
            alliance_id=player.alliance_id, battlegroup=player.alliance_group
        )
        if player.alliance_group is not None:
            dashboard.defense = await cls._defense(session, player)
            dashboard.war = await cls._war(session, player)
        return dashboard

    @staticmethod
    async def _defense(session: SessionDep, player: GameAccount) -> list[DefensePlanNodeResponse]:
        fmt = await SeasonService.get_current_format(session)
        plan = await DefensePlanService.get_active_plan(
            session, player.alliance_id, player.alliance_group, fmt
        )
        if plan is None:
            return []
        nodes = (await plan_response(session, plan)).nodes
        return [n for n in nodes if n.game_account_id == player.id]

    @staticmethod
    async def _war(session: SessionDep, player: GameAccount) -> PlayerDashboardWar | None:
        war = (
            await session.exec(
                select(War).where(
                    War.alliance_id == player.alliance_id, War.status == WarStatus.ACTIVE
                )
            )
        ).first()
        if war is None:
            return None
        return PlayerDashboardWar(
            opponent_name=war.opponent_name,
            battlegroup=player.alliance_group,
            is_ready=await WarService.ready_row(session, war.id, player.alliance_group) is not None,
        )
