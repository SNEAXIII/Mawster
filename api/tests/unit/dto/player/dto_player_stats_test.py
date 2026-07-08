from src.dto.player.dto_player_stats import (
    PlayerStatsCardResponse,
    RatioEvolutionPoint,
    PlayerSeasonAllianceResponse,
    PlayerStatsResponse,
    PlayerSeasonOption,
)


def test_player_stats_response_composes():
    card = PlayerStatsCardResponse(
        ratio=80, total_kos=2, total_not_fought=1, total_fights=10.0, wars_participated=3
    )
    resp = PlayerStatsResponse(
        card=card,
        evolution=[RatioEvolutionPoint(label="Enemy", ratio=80, fights=4.0)],
        alliances=[PlayerSeasonAllianceResponse(name="Avengers", tag="AVG")],
    )
    assert resp.card.ratio == 80
    assert resp.evolution[0].fights == 4.0
    assert resp.alliances[0].tag == "AVG"


def test_player_season_option():
    opt = PlayerSeasonOption(season_id=__import__("uuid").uuid4(), number=64, status="active")
    assert opt.number == 64
