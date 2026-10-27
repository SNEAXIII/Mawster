import uuid

from fastapi import APIRouter

from src.dto.player.dto_player_dashboard import PlayerDashboardResponse
from src.services.account.PlayerDashboardService import PlayerDashboardService
from src.utils.auth_deps import CurrentUser
from src.utils.db import SessionDep

me_dashboard_controller = APIRouter(tags=["Player Dashboard"])


@me_dashboard_controller.get("/me/dashboard", response_model=PlayerDashboardResponse)
async def my_dashboard(game_account_id: uuid.UUID, session: SessionDep, current_user: CurrentUser):
    """What one of the caller's Players has to act on right now."""
    return await PlayerDashboardService.get_dashboard(session, current_user.id, game_account_id)
