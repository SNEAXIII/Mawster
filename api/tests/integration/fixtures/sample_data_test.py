import json
from pathlib import Path

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from src.fixtures import sample_data as sd
from src.fixtures.load_champions import _process_champion_item, _load_capabilities
from src.models.Mastery import Mastery
from src.models.User import User
from src.models.Alliance import Alliance
from src.models.GameAccount import GameAccount

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
