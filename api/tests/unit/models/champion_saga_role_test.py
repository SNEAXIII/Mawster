from src.models.ChampionSagaRole import ChampionSagaRole


def test_champion_saga_role_defaults():
    role = ChampionSagaRole(season_id=None, champion_id=None)
    assert role.is_saga_attacker is False
    assert role.is_saga_defender is False


def test_champion_has_no_global_saga_fields():
    from src.models.Champion import Champion

    assert not hasattr(Champion(name="x", champion_class="Cosmic"), "is_saga_attacker")
    assert not hasattr(Champion(name="x", champion_class="Cosmic"), "is_saga_defender")
