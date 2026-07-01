import json
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[3] / "src" / "fixtures"
CAPS_JSON = FIXTURES / "champions_capabilities.json"
CHAMPIONS_JSON = FIXTURES / "champions.json"

FLAG_KEYS = ("is_ascendable", "has_prefight", "is_saga_attacker", "is_saga_defender")


def _caps():
    return json.loads(CAPS_JSON.read_text(encoding="utf-8"))


def test_caps_is_name_keyed_bool_map():
    caps = _caps()
    assert isinstance(caps, dict) and caps
    for name, flags in caps.items():
        assert set(flags) <= set(FLAG_KEYS)
        assert all(isinstance(v, bool) for v in flags.values())


def test_flag_counts_match_prod_distribution():
    caps = _caps()
    counts = {k: sum(1 for f in caps.values() if f.get(k)) for k in FLAG_KEYS}
    assert counts["is_ascendable"] >= 60
    assert counts["has_prefight"] >= 12
    assert counts["is_saga_attacker"] >= 25
    assert counts["is_saga_defender"] >= 22


def test_capability_names_exist_in_pure_catalogue():
    catalogue = {c["name"] for c in json.loads(CHAMPIONS_JSON.read_text(encoding="utf-8"))}
    unknown = set(_caps()) - catalogue
    # A handful of prod-only names may not exist in the current catalogue; keep it small.
    assert len(unknown) <= 6, f"too many capability names absent from champions.json: {unknown}"
