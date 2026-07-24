# ──────────────────────────────────────────────────────────
# Backward-compatible re-exports – DTOs are now split into
# dedicated modules per model.  Import from the specific
# module when possible.
# ──────────────────────────────────────────────────────────

from src.dto.account.game.dto_champion_user import (  # noqa: F401
    ChampionUserBulkEntry,
    ChampionUserBulkRequest,
    ChampionUserCreateRequest,
    ChampionUserDetailResponse,
    ChampionUserResponse,
)
from src.dto.account.game.dto_game_account import (  # noqa: F401
    GameAccountCreateRequest,
    GameAccountResponse,
)
from src.dto.admin.dto_champion import (  # noqa: F401
    ChampionLoadRequest,
    ChampionPaginatedResponse,
    ChampionResponse,
    ChampionUpdateAliasRequest,
)
from src.dto.alliance.dto_alliance import (  # noqa: F401
    AllianceAddMemberRequest,
    AllianceAddOfficerRequest,
    AllianceCreateRequest,
    AllianceMemberResponse,
    AllianceOfficerResponse,
    AllianceRemoveOfficerRequest,
    AllianceResponse,
    AllianceSetGroupRequest,
)
