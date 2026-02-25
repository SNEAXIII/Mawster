# ──────────────────────────────────────────────────────────
# Backward-compatible re-exports – DTOs are now split into
# dedicated modules per model.  Import from the specific
# module when possible.
# ──────────────────────────────────────────────────────────

from src.dto.dto_game_account import (          # noqa: F401
    GameAccountCreateRequest,
    GameAccountResponse,
)

from src.dto.dto_alliance import (              # noqa: F401
    AllianceCreateRequest,
    AllianceMemberResponse,
    AllianceOfficerResponse,
    AllianceResponse,
    AllianceAddOfficerRequest,
    AllianceRemoveOfficerRequest,
    AllianceAddMemberRequest,
    AllianceSetGroupRequest,
)

from src.dto.dto_champion_user import (         # noqa: F401
    ChampionUserCreateRequest,
    ChampionUserBulkEntry,
    ChampionUserBulkRequest,
    ChampionUserResponse,
    ChampionUserDetailResponse,
)

from src.dto.dto_champion import (              # noqa: F401
    ChampionResponse,
    ChampionAdminViewAll,
    ChampionUpdateAliasRequest,
    ChampionLoadRequest,
)

