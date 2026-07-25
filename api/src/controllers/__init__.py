from src.controllers.account.game.champion_user_controller import champion_user_controller
from src.controllers.account.game.game_account_controller import game_account_controller
from src.controllers.account.game.upgrade_request_controller import upgrade_request_controller
from src.controllers.account.game.vision_controller import vision_controller
from src.controllers.account.me_moderation_controller import me_moderation_controller
from src.controllers.account.user_controller import user_controller
from src.controllers.admin.champion_controller import champion_controller, champion_read_controller
from src.controllers.admin.fight_record_controller import fight_record_controller
from src.controllers.admin.moderation_controller import moderation_controller
from src.controllers.admin.season_controller import (
    season_admin_controller,
    season_public_controller,
)
from src.controllers.admin.user_admin_controller import user_admin_controller
from src.controllers.admin.war_admin_controller import war_admin_controller
from src.controllers.alliance.alliance_core_controller import alliance_core_controller
from src.controllers.alliance.alliance_invitation_controller import alliance_invitation_controller
from src.controllers.alliance.alliance_member_controller import alliance_member_controller
from src.controllers.alliance.alliance_roster_controller import alliance_roster_controller
from src.controllers.alliance.alliance_visitor_controller import alliance_visitor_controller
from src.controllers.alliance.matchup_controller import matchup_controller
from src.controllers.alliance.war.defense_controller import defense_controller
from src.controllers.alliance.war.fight_record_import_controller import (
    fight_record_import_controller,
)
from src.controllers.alliance.war.note_report_controller import note_report_controller
from src.controllers.alliance.war.ranking_history_controller import ranking_history_controller
from src.controllers.alliance.war.statistic_controller import statistics_controller
from src.controllers.alliance.war.war_attacker_controller import war_attacker_controller
from src.controllers.alliance.war.war_core_controller import war_core_controller
from src.controllers.alliance.war.war_note_controller import war_note_controller
from src.controllers.alliance.war.war_placement_controller import war_placement_controller
from src.controllers.alliance.war.war_prefight_controller import war_prefight_controller
from src.controllers.alliance.war.war_synergy_controller import war_synergy_controller
from src.controllers.auth.auth_controller import auth_controller
from src.controllers.stats_controller import stats_controller

routers = [
    user_admin_controller,
    war_admin_controller,
    auth_controller,
    user_controller,
    game_account_controller,
    champion_user_controller,
    upgrade_request_controller,
    vision_controller,
    champion_controller,
    champion_read_controller,
    alliance_invitation_controller,
    alliance_core_controller,
    alliance_member_controller,
    alliance_visitor_controller,
    alliance_roster_controller,
    matchup_controller,
    defense_controller,
    war_core_controller,
    war_placement_controller,
    war_note_controller,
    note_report_controller,
    moderation_controller,
    me_moderation_controller,
    war_attacker_controller,
    war_synergy_controller,
    war_prefight_controller,
    fight_record_import_controller,
    season_admin_controller,
    season_public_controller,
    statistics_controller,
    fight_record_controller,
    ranking_history_controller,
    stats_controller,
]
