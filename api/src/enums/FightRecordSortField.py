from enum import Enum


class FightRecordSortField(str, Enum):
    CREATED_AT = "created_at"
    SEASON_NUMBER = "season_number"
    KO_COUNT = "ko_count"
    TIER = "tier"
    NODE_NUMBER = "node_number"
    BATTLEGROUP = "battlegroup"
    CHAMPION_NAME = "champion_name"
    DEFENDER_CHAMPION_NAME = "defender_champion_name"
    ALLIANCE_NAME = "alliance_name"
