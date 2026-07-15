# ─── Matchup error messages ─────────────────────────────
MATCHUP_NOT_FOUND = "Matchup rating not found"
CHAMPION_NOT_FOUND = "Champion not found"
# TODO: the at-most-2-synergies cap is enforced declaratively by `Field(max_length=2)`, which
# raises Pydantic's own message. If a friendlier message is ever needed, replace that with a
# custom validator here rather than reintroducing an unused constant.
DUPLICATE_TARGET_TYPE = "A request cannot carry two targets of the same type"
SINGLE_TARGET_REQUIRED = "A rating targets either a defender or a node, never both"
GAME_ACCOUNT_NOT_IN_ALLIANCE = "This game account is not a member of this alliance"
DISCOURAGED_HAS_NO_SCORE = "A discouraged matchup carries no score"
SCORE_REQUIRED_WHEN_NOT_DISCOURAGED = "A matchup that is not discouraged must carry a score"
NODE_DETAIL_MISMATCH = "A grid cell and its node detail must describe the same node"
