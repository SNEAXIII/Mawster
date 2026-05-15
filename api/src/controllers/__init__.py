from src.controllers.admin.admin_controller import admin_controller
from src.controllers.admin.champion_controller import champion_controller, champion_read_controller
from src.controllers.admin.season_controller import (
    season_admin_controller,
    season_public_controller,
)
from src.controllers.admin.fight_record_controller import fight_record_controller
from src.controllers.auth.auth_controller import auth_controller
from src.controllers.account.user_controller import user_controller
from src.controllers.account.game.game_account_controller import game_account_controller
from src.controllers.account.game.champion_user_controller import champion_user_controller
from src.controllers.alliance.alliance_controller import alliance_controller
from src.controllers.alliance.war.defense_controller import defense_controller
from src.controllers.alliance.war.war_controller import war_controller
from src.controllers.alliance.war.statistic_controller import statistics_controller

routers = [
    admin_controller,
    auth_controller,
    user_controller,
    game_account_controller,
    alliance_controller,
    champion_user_controller,
    champion_controller,
    champion_read_controller,
    defense_controller,
    war_controller,
    season_admin_controller,
    season_public_controller,
    statistics_controller,
    fight_record_controller,
]
