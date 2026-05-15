from src.controllers.admin.user_admin_controller import user_admin_controller
from src.controllers.admin.war_admin_controller import war_admin_controller
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
from src.controllers.alliance.war.statistic_controller import statistics_controller
from src.controllers.alliance.war.war_core_controller import war_core_controller
from src.controllers.alliance.war.war_placement_controller import war_placement_controller
from src.controllers.alliance.war.war_attacker_controller import war_attacker_controller
from src.controllers.alliance.war.war_synergy_controller import war_synergy_controller
from src.controllers.alliance.war.war_prefight_controller import war_prefight_controller

routers = [
    user_admin_controller,
    war_admin_controller,
    auth_controller,
    user_controller,
    game_account_controller,
    alliance_controller,
    champion_user_controller,
    champion_controller,
    champion_read_controller,
    defense_controller,
    war_core_controller,
    war_placement_controller,
    war_attacker_controller,
    war_synergy_controller,
    war_prefight_controller,
    season_admin_controller,
    season_public_controller,
    statistics_controller,
    fight_record_controller,
]
