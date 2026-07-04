import collections

from src.fixtures import sample_data as sd


def test_roster_size_bounds_and_deterministic():
    sizes = [sd.roster_size(i) for i in range(200)]
    assert all(15 <= s <= 45 for s in sizes)
    assert sizes == [sd.roster_size(i) for i in range(200)]  # deterministic


def test_roster_rank_distribution_matches_prod_shape():
    size = 60
    ranks = collections.Counter(sd.roster_rank(slot, size) for slot in range(size))
    assert set(ranks) <= {1, 2, 3, 4, 5}
    assert ranks[4] >= ranks[3] >= ranks[5]  # r4 most common, r3 next, r5 rarer
    assert ranks[1] >= 1 and ranks[2] >= 1  # low ranks present


def test_ascension_zero_when_not_ascendable():
    for slot in range(60):
        for idx in range(10):
            assert sd.roster_ascension(slot, idx, rank=4, is_ascendable=False) == 0


def test_ascension_zero_below_rank_4():
    assert all(
        sd.roster_ascension(slot, idx, rank=3, is_ascendable=True) == 0
        for slot in range(60)
        for idx in range(10)
    )


def test_ascension_can_be_nonzero_for_ascendable_high_rank():
    values = {
        sd.roster_ascension(slot, idx, rank=5, is_ascendable=True)
        for slot in range(60)
        for idx in range(10)
    }
    assert values <= {0, 1, 2}
    assert values & {1, 2}  # at least some ascension applied


def test_signature_in_catalogue_values():
    allowed = set(sd.SIG_CYCLE)
    assert {sd.roster_signature(slot, idx) for slot in range(60) for idx in range(10)} <= allowed


def test_exactly_one_preferred_per_roster():
    for idx in range(30):
        size = sd.roster_size(idx)
        preferred = [slot for slot in range(size) if sd.is_preferred_slot(slot, idx, size)]
        assert len(preferred) == 1
