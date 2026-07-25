import json
from pathlib import Path

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from src.fixtures import sample_data as sd
from src.fixtures.load_champions import _load_capabilities, _process_champion_item
from src.models.Alliance import Alliance
from src.models.AllianceVisitor import AllianceVisitor
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.models.Mastery import Mastery
from src.models.Season import Season
from src.models.User import User
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarPrefightAttacker import WarPrefightAttacker

FIXTURES = Path(__file__).resolve().parents[3] / "src" / "fixtures"


@pytest.fixture(scope="module")
def seeded_session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    caps = _load_capabilities()
    with Session(engine) as s:
        for item in json.loads((FIXTURES / "champions.json").read_text(encoding="utf-8")):
            _process_champion_item(s, item, caps)
        for m in json.loads((FIXTURES / "masteries.json").read_text(encoding="utf-8")):
            s.add(Mastery(name=m["name"], max_value=m["max_value"], order=m.get("order", 0)))
        s.commit()
    sd.load_sample_data(engine)
    with Session(engine) as s:
        yield s


def test_seed_has_google_users(seeded_session):
    users = seeded_session.exec(select(User)).all()
    assert sum(1 for u in users if u.google_id) >= 2


def test_seed_has_disabled_user(seeded_session):
    users = seeded_session.exec(select(User)).all()
    assert any(u.disabled_at is not None for u in users)


def test_seed_has_multiple_alliances(seeded_session):
    alliances = seeded_session.exec(select(Alliance)).all()
    assert len(alliances) >= 3
    assert any(a.tier == 20 and a.elo == 0 for a in alliances)  # empty unranked alliance


def test_seed_has_non_primary_accounts(seeded_session):
    gas = seeded_session.exec(select(GameAccount)).all()
    assert sum(1 for g in gas if not g.is_primary) >= 2


def test_seed_has_seasons(seeded_session):
    seasons = seeded_session.exec(select(Season)).all()
    numbers = {s.number for s in seasons}
    assert {60, 61, 62, 63, 64, 65, 66, 67} <= numbers
    active = [s for s in seasons if s.status.value == "active"]
    assert len(active) == 1 and active[0].number == 67


def test_seed_has_three_wars(seeded_session):
    wars = seeded_session.exec(select(War)).all()
    assert len(wars) == 3
    assert sum(1 for w in wars if w.status.value == "active") == 1
    assert sum(1 for w in wars if w.status.value == "ended") == 2


def test_war_defense_nodes_within_bounds(seeded_session):
    placements = seeded_session.exec(select(WarDefensePlacement)).all()
    assert placements
    assert all(1 <= p.node_number <= 50 for p in placements)
    assert all(1 <= p.battlegroup <= 3 for p in placements)


def test_prefight_attackers_have_prefight_capability(seeded_session):
    rows = seeded_session.exec(select(WarPrefightAttacker)).all()
    assert rows, "expected at least one prefight attacker"
    for r in rows:
        cu = seeded_session.get(ChampionUser, r.champion_user_id)
        champ = seeded_session.get(Champion, cu.champion_id)
        assert champ.has_prefight is True


def test_ascended_champion_users_are_ascendable(seeded_session):
    rows = seeded_session.exec(select(ChampionUser).where(ChampionUser.ascension > 0)).all()
    assert rows, "expected some ascended champions"
    for cu in rows:
        champ = seeded_session.get(Champion, cu.champion_id)
        assert champ.is_ascendable is True


def test_seed_has_alliance_visitor(seeded_session):
    visitors = seeded_session.exec(select(AllianceVisitor)).all()
    assert len(visitors) >= 1
