"""Backward-compatible re-export shim.

All service classes have been moved to their own modules:
  - GameAccountService  → src.services.GameAccountService
  - AllianceService     → src.services.AllianceService
  - ChampionUserService → src.services.ChampionUserService

This file re-exports them so existing imports keep working.
"""

from src.services.GameAccountService import GameAccountService, MAX_GAME_ACCOUNTS_PER_USER  # noqa: F401
from src.services.AllianceService import AllianceService, MAX_MEMBERS_PER_GROUP, MAX_MEMBERS_PER_ALLIANCE  # noqa: F401
from src.services.ChampionUserService import ChampionUserService  # noqa: F401
