from sqlmodel import Session, SQLModel, create_engine, select

from src.fixtures.load_champions import _load_capabilities, _process_champion_item
from src.models.Champion import Champion

CAPS = {
    "Hercules": {"is_ascendable": True, "has_prefight": True},
}


def _session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_new_champion_gets_flags_from_capabilities():
    session = _session()
    item = {"name": "Hercules", "champion_class": "Cosmic", "image_url": None}
    assert _process_champion_item(session, item, CAPS) == "added"
    session.commit()
    champ = session.exec(select(Champion).where(Champion.name == "Hercules")).one()
    assert champ.is_ascendable is True
    assert champ.has_prefight is True


def test_champion_without_capabilities_defaults_false():
    session = _session()
    item = {"name": "Nobody", "champion_class": "Tech"}
    assert _process_champion_item(session, item, {}) == "added"
    session.commit()
    champ = session.exec(select(Champion).where(Champion.name == "Nobody")).one()
    assert champ.is_ascendable is False
    assert champ.has_prefight is False


def test_existing_champion_flag_update():
    session = _session()
    session.add(Champion(name="Kitty", champion_class="Mutant"))
    session.commit()
    item = {"name": "Kitty", "champion_class": "Mutant"}
    caps = {"Kitty": {"is_ascendable": True}}
    assert _process_champion_item(session, item, caps) == "updated"
    session.commit()
    champ = session.exec(select(Champion).where(Champion.name == "Kitty")).one()
    assert champ.is_ascendable is True


def test_real_capabilities_file_loads():
    caps = _load_capabilities()
    assert isinstance(caps, dict) and caps
    assert sum(1 for f in caps.values() if f.get("has_prefight")) >= 12
