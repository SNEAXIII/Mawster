import pytest


"""
IMPLEMENTATION INSTRUCTIONS — Champion ascendable endpoint

Endpoint under test:
- PATCH /admin/champions/{champion_id}/ascendable

Expected behavior:
1) Admin can toggle `is_ascendable` true -> false.
2) Admin can toggle `is_ascendable` false -> true.
3) Regular user receives 403.
4) Unauthenticated request receives 401.
5) Unknown champion receives 404.

Implementation notes:
- Reuse fixtures/helpers from `champion_test.py` where possible.
- Keep payload empty (endpoint toggles state server-side).
- Validate state change by reading champion after patch.
"""


@pytest.mark.skip(reason='TODO: implement ascendable endpoint integration coverage')
class TestChampionAscendableEndpoint:
    async def test_admin_can_toggle_true_to_false(self):
        """Steps: create ascendable champion, PATCH once, assert 200 and is_ascendable=False."""
        # Intentionally pending implementation.
        pass

    async def test_admin_can_toggle_false_to_true(self):
        """Steps: create non-ascendable champion, PATCH once, assert 200 and is_ascendable=True."""
        # Intentionally pending implementation.
        pass

    async def test_non_admin_is_forbidden(self):
        """Steps: call PATCH as USER role, assert 403."""
        # Intentionally pending implementation.
        pass

    async def test_unauthenticated_is_401(self):
        """Steps: call PATCH without token, assert 401."""
        # Intentionally pending implementation.
        pass

    async def test_unknown_champion_is_404(self):
        """Steps: call PATCH with random UUID as admin, assert 404."""
        # Intentionally pending implementation.
        pass
