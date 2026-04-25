---
name: test-python
description: Write Python tests (unit and integration) for backend FastAPI/SQLModel features in this project. Use when adding a new endpoint, service, or DTO that needs tests, or when tests are missing for an existing feature. Invoke whenever the user says "fais des tests", "écris des tests", "add tests", "write tests", "tests pour X", or when code changes need test coverage. Always research the implementation first before writing tests.
---

# Python Test Writer

Write tests for FastAPI/SQLModel backend features. Always research before writing — read the implementation, then read similar existing tests to match conventions.

## Step 1: Research

Read these files before writing any test:

**Implementation to test:**
- `api/src/controllers/<feature>_controller.py` — endpoints, auth deps, routes
- `api/src/services/<Feature>Service.py` — business logic
- `api/src/dto/dto_<feature>.py` — request/response schemas
- `api/src/models/<Model>.py` — any model involved in the feature

**Existing test patterns (read one similar test file):**
- `api/tests/integration/endpoints/season_test.py` — good reference for integration tests
- `api/tests/integration/endpoints/war_test.py` — shows more complex DB setup

**Available helpers:**
- `api/tests/integration/endpoints/setup/game_setup.py` — push_alliance_with_owner, push_member, push_champion, push_champion_user, etc.
- `api/tests/integration/endpoints/setup/user_setup.py` — get_generic_user, push_user2, get_admin
- `api/tests/utils/utils_constant.py` — USER_ID, USER2_ID, GAME_PSEUDO, ALLIANCE_NAME, etc.
- `api/tests/utils/utils_db.py` — load_objects, reset_test_db, get_test_session
- `api/tests/utils/utils_client.py` — execute_get/post/patch/delete_request, create_auth_headers

## Step 2: Decide What to Write

**Integration tests** (`api/tests/integration/endpoints/<feature>_test.py`):
Cover the HTTP layer end-to-end with real DB. Always write these.

**Unit tests — DTO** (`api/tests/unit/dto/dto_<feature>_test.py`):
Write when the DTO has validation logic (validators, constraints, required fields).

**Unit tests — Service** (`api/tests/unit/service/service_<feature>_test.py`):
Write when there is business logic that can be tested without hitting the DB (pure functions, transformations, error conditions on simple inputs).

## Step 3: Write Integration Tests

### File structure

```python
"""Integration tests for <feature> endpoints."""

import pytest
from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.utils.utils_client import create_auth_headers, execute_get_request, ...
from tests.utils.utils_constant import USER_ID, USER2_ID
from tests.utils.utils_db import get_test_session, load_objects, reset_test_db
from tests.integration.endpoints.setup.game_setup import push_alliance_with_owner, ...
from tests.integration.endpoints.setup.user_setup import get_generic_user, ...

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)

BASE_URL = "/route/prefix"


@pytest.fixture(autouse=True)
def clean_db():
    reset_test_db()


async def _setup_...():
    """Setup helper — insert only what this test group needs."""
    await load_objects([get_generic_user(is_base_id=True)])
    ...


class TestFeatureName:
    @pytest.mark.anyio
    async def test_...(self):
        ...
```

### Mandatory conventions

- **`pytest.mark.anyio`** — always, never `asyncio`
- **`autouse clean_db`** fixture calling `reset_test_db()` — every file
- **`app.dependency_overrides[get_session] = get_test_session`** — at module level
- **Insert user first** — `get_generic_user(is_base_id=True)` must be loaded before any game account
- **Insert FK parents before children** — alliance before game_account, season before war, etc.
- **`load_objects([obj1, obj2])`** — for direct DB insertion (not via HTTP)

### Auth behavior to know

- `assert_is_alliance_member` → **404** (not 403) when user has no game account in the alliance or alliance doesn't exist
- Admin-only endpoints → 403 for regular user
- Unauthenticated → 401

### Test cases to cover per endpoint

For every endpoint, always cover:
1. **Happy path** — correct data, correct user → expected response + body fields
2. **Empty/no data** — no records yet → `[]` or `null`, not an error
3. **Access control** — wrong role or non-member → 4xx
4. **Not found** — unknown ID → 404

For POST/PATCH with validation:
5. **Duplicate/conflict** → 409
6. **Invalid payload** → 422

For calculated fields (stats, ratios):
7. **Edge case inputs** — 0 fights, all KOs, no miniboss, etc.

## Step 4: Write Unit Tests

### DTO unit tests

Test Pydantic validation only — no DB, no HTTP:

```python
class TestMyRequestDTO:
    def test_valid_input(self):
        obj = MyRequest(field="value")
        assert obj.field == "value"

    def test_required_field_raises(self):
        with pytest.raises(ValidationError):
            MyRequest()

    def test_invalid_value_raises(self):
        with pytest.raises(ValidationError):
            MyRequest(field=-1)
```

### Service unit tests

Only write these when the service has pure logic testable without DB. Don't duplicate DTO tests here. If the service just wraps DB queries, skip the unit test.

## Step 5: Run and Fix

Run with:
```bash
uv run pytest tests/integration/endpoints/<feature>_test.py -v --tb=short
```
(from `api/` directory)

Fix failures by reading the error message:
- `404` where you expected `403` → `assert_is_alliance_member` returns 404
- `IntegrityError` → FK insertion order wrong, or unique constraint violated
- `422` → payload field missing or wrong type
- `assert X == Y` mismatch → re-read the service logic for the actual return value

All tests must pass before reporting done.
