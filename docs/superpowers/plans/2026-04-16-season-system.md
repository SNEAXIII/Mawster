# Season System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global season system so admins can activate/deactivate seasons (e.g., "Season 64"), wars are auto-linked to the active season, and the war page shows a clear in-season / off-season indicator.

**Architecture:** New global `Season` table (number + is_active flag). Wars get a nullable `season_id` FK set at creation time. Admin endpoints manage seasons; a public endpoint exposes the current one. The war page shows a season badge and a bans placeholder.

**Tech Stack:** FastAPI + SQLModel + Alembic (backend), Next.js App Router + React 19 + Tailwind (frontend), pytest + Cypress (tests).

---

## File Map

### Create
| File | Purpose |
|---|---|
| `api/src/models/Season.py` | SQLModel Season table |
| `api/src/Messages/season_messages.py` | Error message constants |
| `api/src/dto/dto_season.py` | SeasonCreateRequest, SeasonResponse |
| `api/src/services/SeasonService.py` | Business logic |
| `api/src/controllers/season_controller.py` | Admin + public routers |
| `api/migrations/versions/XXXX_add_season.py` | Alembic migration |
| `api/tests/unit/service/service_season_test.py` | DTO validation unit tests |
| `api/tests/integration/endpoints/season_test.py` | Season endpoint integration tests |
| `front/app/services/season.ts` | Frontend API wrapper |
| `front/app/game/war/_components/season-banner.tsx` | Season badge component |
| `front/app/game/war/_components/season-bans-placeholder.tsx` | Bans placeholder component |
| `front/app/admin/_components/seasons-panel.tsx` | Admin seasons management panel |
| `front/cypress/e2e/war/season.cy.ts` | E2E tests |

### Modify
| File | Change |
|---|---|
| `api/src/models/War.py` | Add nullable `season_id` FK |
| `api/src/dto/dto_war.py` | Add `season_id` + `season_number` to WarResponse |
| `api/src/services/WarService.py` | Auto-link active season in `create_war` |
| `api/main.py` | Register season controllers |
| `front/app/i18n/locales/en.ts` | Add season i18n keys |
| `front/app/i18n/locales/fr.ts` | Add season i18n keys |
| `front/app/game/war/_components/war-content.tsx` | Add SeasonBanner + SeasonBansPlaceholder |
| `front/app/admin/_components/admin-content.tsx` | Add Seasons tab |
| `front/app/admin/_viewmodels/use-admin-viewmodel.ts` | Add `Seasons` to AdminTab enum |

---

## Task 1 — Season model

**Files:**
- Create: `api/src/models/Season.py`

- [ ] **Step 1: Create the model**

```python
# api/src/models/Season.py
import uuid
from sqlmodel import Field, SQLModel


class Season(SQLModel, table=True):
    __tablename__ = "season"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    number: int = Field(unique=True)
    is_active: bool = Field(default=False)
    # TODO (Approach B): add started_at: datetime and ended_at: Optional[datetime]
    # Active season = started_at IS NOT NULL AND ended_at IS NULL
    # This enables automated activation/deactivation based on the game calendar.
```

- [ ] **Step 2: Export from models `__init__.py`**

Open `api/src/models/__init__.py` and add:
```python
from src.models.Season import Season
```

- [ ] **Step 3: Commit**

```bash
git add api/src/models/Season.py api/src/models/__init__.py
git commit -m "feat: add Season SQLModel table"
```

---

## Task 2 — Season messages and DTOs

**Files:**
- Create: `api/src/Messages/season_messages.py`
- Create: `api/src/dto/dto_season.py`

- [ ] **Step 1: Create messages**

```python
# api/src/Messages/season_messages.py
SEASON_NOT_FOUND = "Season not found"
SEASON_NUMBER_ALREADY_EXISTS = "A season with this number already exists"
```

- [ ] **Step 2: Create DTOs**

```python
# api/src/dto/dto_season.py
import uuid
from pydantic import BaseModel, ConfigDict, Field


class SeasonCreateRequest(BaseModel):
    number: int = Field(..., ge=1)


class SeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    is_active: bool
```

- [ ] **Step 3: Commit**

```bash
git add api/src/Messages/season_messages.py api/src/dto/dto_season.py
git commit -m "feat: add season DTOs and messages"
```

---

## Task 3 — SeasonService unit tests (write failing first)

**Files:**
- Create: `api/tests/unit/service/service_season_test.py`

- [ ] **Step 1: Write failing DTO unit tests**

```python
# api/tests/unit/service/service_season_test.py
"""Unit tests for season DTO validation."""
import pytest

from src.dto.dto_season import SeasonCreateRequest


class TestSeasonCreateRequest:
    def test_valid_number(self):
        req = SeasonCreateRequest(number=64)
        assert req.number == 64

    def test_number_must_be_positive(self):
        with pytest.raises(Exception):
            SeasonCreateRequest(number=0)

    def test_number_negative_raises(self):
        with pytest.raises(Exception):
            SeasonCreateRequest(number=-1)

    def test_number_required(self):
        with pytest.raises(Exception):
            SeasonCreateRequest()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest api/tests/unit/service/service_season_test.py -v
```

Expected: `ModuleNotFoundError` or `ImportError` (dto doesn't exist yet — already created in Task 2, so tests should pass if run after Task 2).

- [ ] **Step 3: Run tests to confirm they pass after Task 2**

```bash
uv run pytest api/tests/unit/service/service_season_test.py -v
```

Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add api/tests/unit/service/service_season_test.py
git commit -m "test: add SeasonCreateRequest unit tests"
```

---

## Task 4 — SeasonService implementation

**Files:**
- Create: `api/src/services/SeasonService.py`

- [ ] **Step 1: Implement SeasonService**

```python
# api/src/services/SeasonService.py
import uuid

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.models.Season import Season
from src.Messages.season_messages import SEASON_NOT_FOUND, SEASON_NUMBER_ALREADY_EXISTS
from src.utils.db import SessionDep


class SeasonService:

    @classmethod
    async def get_active_season(cls, session: SessionDep) -> Season | None:
        result = await session.exec(select(Season).where(Season.is_active == True))
        return result.first()

    @classmethod
    async def get_all_seasons(cls, session: SessionDep) -> list[Season]:
        result = await session.exec(select(Season).order_by(Season.number.desc()))
        return list(result.all())

    @classmethod
    async def create_season(cls, session: SessionDep, number: int) -> Season:
        existing = await session.exec(select(Season).where(Season.number == number))
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=SEASON_NUMBER_ALREADY_EXISTS,
            )
        season = Season(number=number)
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season

    @classmethod
    async def activate_season(cls, session: SessionDep, season_id: uuid.UUID) -> Season:
        season = await session.get(Season, season_id)
        if season is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=SEASON_NOT_FOUND)
        # Deactivate all active seasons before activating the new one
        active_seasons = await session.exec(select(Season).where(Season.is_active == True))
        for s in active_seasons.all():
            s.is_active = False
            session.add(s)
        season.is_active = True
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season

    @classmethod
    async def deactivate_season(cls, session: SessionDep, season_id: uuid.UUID) -> Season:
        season = await session.get(Season, season_id)
        if season is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=SEASON_NOT_FOUND)
        season.is_active = False
        session.add(season)
        await session.commit()
        await session.refresh(season)
        return season
```

- [ ] **Step 2: Commit**

```bash
git add api/src/services/SeasonService.py
git commit -m "feat: implement SeasonService"
```

---

## Task 5 — Season controller + register in main.py

**Files:**
- Create: `api/src/controllers/season_controller.py`
- Modify: `api/main.py`

- [ ] **Step 1: Create the controller**

```python
# api/src/controllers/season_controller.py
import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.dto_season import SeasonCreateRequest, SeasonResponse
from src.services.AuthService import AuthService
from src.services.SeasonService import SeasonService
from src.utils.db import SessionDep

season_admin_controller = APIRouter(
    prefix="/admin/seasons",
    tags=["Season"],
    dependencies=[
        Depends(AuthService.is_logged_as_admin),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)

season_public_controller = APIRouter(
    prefix="/seasons",
    tags=["Season"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@season_admin_controller.post(
    "",
    response_model=SeasonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_season(body: SeasonCreateRequest, session: SessionDep):
    """Create a new season. Admin only."""
    return await SeasonService.create_season(session, body.number)


@season_admin_controller.get("", response_model=list[SeasonResponse])
async def list_seasons(session: SessionDep):
    """List all seasons ordered by number desc. Admin only."""
    return await SeasonService.get_all_seasons(session)


@season_admin_controller.patch("/{season_id}/activate", response_model=SeasonResponse)
async def activate_season(season_id: uuid.UUID, session: SessionDep):
    """Activate a season (auto-deactivates any currently active season). Admin only."""
    return await SeasonService.activate_season(session, season_id)


@season_admin_controller.patch("/{season_id}/deactivate", response_model=SeasonResponse)
async def deactivate_season(season_id: uuid.UUID, session: SessionDep):
    """Deactivate a season (moves to off-season). Admin only."""
    return await SeasonService.deactivate_season(session, season_id)


@season_public_controller.get("/current", response_model=Optional[SeasonResponse])
async def get_current_season(session: SessionDep):
    """Return the active season, or null if off-season."""
    return await SeasonService.get_active_season(session)
```

- [ ] **Step 2: Register controllers in main.py**

In `api/main.py`, add the imports after the existing controller imports:

```python
from src.controllers.season_controller import season_admin_controller, season_public_controller
```

Then add after the existing `app.include_router(...)` calls:

```python
app.include_router(season_admin_controller)
app.include_router(season_public_controller)
```

- [ ] **Step 3: Commit**

```bash
git add api/src/controllers/season_controller.py api/main.py
git commit -m "feat: add season controller and register routes"
```

---

## Task 6 — Alembic migration

**Files:**
- Create: `api/migrations/versions/XXXX_add_season.py`

- [ ] **Step 1: Generate migration stub**

Use the `make` skill to run:
```
make create-mig name=add_season
```

This creates a new file in `api/migrations/versions/`. Note its filename.

- [ ] **Step 2: Replace the generated upgrade/downgrade with the correct content**

Edit the generated file — keep the header (revision, down_revision, branch_labels, depends_on) and replace the body:

```python
def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'season',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('number', name='uq_season_number'),
    )
    op.add_column('war', sa.Column('season_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_war_season', 'war', 'season', ['season_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_war_season', 'war', type_='foreignkey')
    op.drop_column('war', 'season_id')
    op.drop_table('season')
```

- [ ] **Step 3: Run migration**

Use the `db-migrate` skill.

- [ ] **Step 4: Commit**

```bash
git add api/migrations/versions/
git commit -m "feat: migration — add season table and war.season_id"
```

---

## Task 7 — Update War model, WarResponse DTO, and WarService

**Files:**
- Modify: `api/src/models/War.py`
- Modify: `api/src/dto/dto_war.py`
- Modify: `api/src/services/WarService.py`

- [ ] **Step 1: Add season_id FK to War model**

In `api/src/models/War.py`, add import and field:

```python
# After existing imports, add:
from typing import Optional

# Inside the War class, add after created_at:
season_id: Optional[uuid.UUID] = Field(default=None, foreign_key="season.id")
```

Also add the relationship (add to TYPE_CHECKING block):
```python
if TYPE_CHECKING:
    # existing...
    from src.models.Season import Season
```

And in the class body after existing relationships:
```python
season: Optional["Season"] = Relationship(
    sa_relationship_kwargs={"foreign_keys": "[War.season_id]"},
)
```

- [ ] **Step 2: Add season fields to WarResponse DTO**

In `api/src/dto/dto_war.py`, update `WarResponse`:

```python
class WarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alliance_id: uuid.UUID
    opponent_name: str
    status: str
    created_by_pseudo: str
    created_at: datetime
    banned_champions: List[ChampionResponse] = []
    season_id: Optional[uuid.UUID] = None
    season_number: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'alliance_id': data.alliance_id,
            'opponent_name': data.opponent_name,
            'status': data.status,
            'created_by_pseudo': data.created_by.game_pseudo,
            'created_at': data.created_at,
            'banned_champions': [ban.champion for ban in data.bans],
            'season_id': data.season_id,
            'season_number': data.season.number if data.season else None,
        }
```

Also add `Optional` to imports: `from typing import Any, List, Optional`.

- [ ] **Step 3: Auto-link active season in WarService.create_war**

In `api/src/services/WarService.py`, add import at the top:

```python
from src.services.SeasonService import SeasonService
```

Then in `create_war`, replace the `war = War(...)` block with:

```python
active_season = await SeasonService.get_active_season(session)
war = War(
    alliance_id=alliance_id,
    opponent_name=opponent_name,
    created_by_id=created_by_id,
    season_id=active_season.id if active_season else None,
)
```

Also update `_load_war` selectinload if it exists to include `season`. Search for `selectinload` usage in `WarService.py` and add:
```python
selectinload(War.season)
```
alongside the existing selectinloads.

- [ ] **Step 4: Run backend tests to check nothing is broken**

Use the `test-backend` skill.

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/src/models/War.py api/src/dto/dto_war.py api/src/services/WarService.py
git commit -m "feat: link War to active Season at creation time"
```

---

## Task 8 — Season integration tests

**Files:**
- Create: `api/tests/integration/endpoints/season_test.py`

- [ ] **Step 1: Write the integration tests**

```python
# api/tests/integration/endpoints/season_test.py
"""Integration tests for season endpoints."""
import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_patch_request,
)
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(user_id="00000000-0000-0000-0000-000000000001", role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(user_id="00000000-0000-0000-0000-000000000001", role=Roles.USER)

SEASONS_URL = "/admin/seasons"
CURRENT_URL = "/seasons/current"


class TestCreateSeason:
    @pytest.mark.anyio
    async def test_admin_can_create_season(self):
        response = await execute_post_request(SEASONS_URL, {"number": 64}, ADMIN_HEADERS)
        assert response.status_code == 201
        data = response.json()
        assert data["number"] == 64
        assert data["is_active"] is False

    @pytest.mark.anyio
    async def test_duplicate_number_returns_409(self):
        await execute_post_request(SEASONS_URL, {"number": 65}, ADMIN_HEADERS)
        response = await execute_post_request(SEASONS_URL, {"number": 65}, ADMIN_HEADERS)
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_non_admin_returns_403(self):
        response = await execute_post_request(SEASONS_URL, {"number": 66}, USER_HEADERS)
        assert response.status_code == 403


class TestActivateSeason:
    @pytest.mark.anyio
    async def test_activate_sets_is_active_true(self):
        create = await execute_post_request(SEASONS_URL, {"number": 70}, ADMIN_HEADERS)
        season_id = create.json()["id"]
        response = await execute_patch_request(f"{SEASONS_URL}/{season_id}/activate", {}, ADMIN_HEADERS)
        assert response.status_code == 200
        assert response.json()["is_active"] is True

    @pytest.mark.anyio
    async def test_activating_deactivates_previous(self):
        s1 = (await execute_post_request(SEASONS_URL, {"number": 71}, ADMIN_HEADERS)).json()
        s2 = (await execute_post_request(SEASONS_URL, {"number": 72}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s1['id']}/activate", {}, ADMIN_HEADERS)
        await execute_patch_request(f"{SEASONS_URL}/{s2['id']}/activate", {}, ADMIN_HEADERS)
        # s1 should now be inactive
        all_seasons = (await execute_get_request(SEASONS_URL, ADMIN_HEADERS)).json()
        s1_data = next(s for s in all_seasons if s["id"] == s1["id"])
        assert s1_data["is_active"] is False

    @pytest.mark.anyio
    async def test_activate_unknown_season_returns_404(self):
        response = await execute_patch_request(
            f"{SEASONS_URL}/00000000-0000-0000-0000-000000000099/activate", {}, ADMIN_HEADERS
        )
        assert response.status_code == 404


class TestDeactivateSeason:
    @pytest.mark.anyio
    async def test_deactivate_sets_is_active_false(self):
        s = (await execute_post_request(SEASONS_URL, {"number": 80}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/activate", {}, ADMIN_HEADERS)
        response = await execute_patch_request(f"{SEASONS_URL}/{s['id']}/deactivate", {}, ADMIN_HEADERS)
        assert response.status_code == 200
        assert response.json()["is_active"] is False


class TestGetCurrentSeason:
    @pytest.mark.anyio
    async def test_returns_null_when_no_active_season(self):
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        assert response.json() is None

    @pytest.mark.anyio
    async def test_returns_active_season(self):
        s = (await execute_post_request(SEASONS_URL, {"number": 90}, ADMIN_HEADERS)).json()
        await execute_patch_request(f"{SEASONS_URL}/{s['id']}/activate", {}, ADMIN_HEADERS)
        response = await execute_get_request(CURRENT_URL, USER_HEADERS)
        assert response.status_code == 200
        assert response.json()["number"] == 90
        assert response.json()["is_active"] is True
```

- [ ] **Step 2: Run the integration tests**

Use the `test-backend` skill, or:
```bash
uv run pytest api/tests/integration/endpoints/season_test.py -v
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add api/tests/integration/endpoints/season_test.py
git commit -m "test: add season endpoint integration tests"
```

---

## Task 9 — War+Season integration test

**Files:**
- Modify: `api/tests/integration/endpoints/war_test.py`

- [ ] **Step 1: Add tests verifying war links to active season**

At the bottom of `api/tests/integration/endpoints/war_test.py`, add:

```python
from src.models.Season import Season
from tests.utils.utils_db import load_objects


class TestWarSeasonLink:
    @pytest.mark.anyio
    async def test_war_created_with_active_season(self):
        """War created while a season is active gets that season_id."""
        alliance, owner, member, champion, champion_user = await _setup_alliance()
        # Create and activate a season
        season = Season(number=64, is_active=True)
        await load_objects([season])

        headers = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars",
            {"opponent_name": OPPONENT, "banned_champion_ids": []},
            headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["season_id"] == str(season.id)
        assert data["season_number"] == 64

    @pytest.mark.anyio
    async def test_war_created_without_active_season_is_off_season(self):
        """War created when no season is active has season_id=null."""
        alliance, owner, member, champion, champion_user = await _setup_alliance()

        headers = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars",
            {"opponent_name": OPPONENT, "banned_champion_ids": []},
            headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["season_id"] is None
        assert data["season_number"] is None
```

- [ ] **Step 2: Run the tests**

```bash
uv run pytest api/tests/integration/endpoints/war_test.py::TestWarSeasonLink -v
```

Expected: 2 passed.

- [ ] **Step 3: Run full backend test suite**

Use the `test-backend` skill.

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add api/tests/integration/endpoints/war_test.py
git commit -m "test: verify war auto-links to active season"
```

---

## Task 10 — i18n keys

**Files:**
- Modify: `front/app/i18n/locales/en.ts`
- Modify: `front/app/i18n/locales/fr.ts`

- [ ] **Step 1: Add season keys to en.ts**

Find the `war:` section in `front/app/i18n/locales/en.ts` and add a `season:` block at the same level (alongside `war:`, `defense:`, etc.):

```typescript
season: {
  current: 'Season {number}',
  offSeason: 'Off-season',
  bans: {
    title: 'Season bans',
    comingSoon: 'Coming soon',
  },
  admin: {
    title: 'Seasons',
    createButton: 'Create season',
    numberLabel: 'Season number',
    numberPlaceholder: 'e.g. 64',
    activateButton: 'Activate',
    deactivateButton: 'Deactivate',
    active: 'Active',
    inactive: 'Inactive',
    createSuccess: 'Season created',
    activateSuccess: 'Season activated',
    deactivateSuccess: 'Season deactivated',
    createError: 'Failed to create season',
    activateError: 'Failed to activate season',
    deactivateError: 'Failed to deactivate season',
  },
},
```

Also add `seasons: 'Seasons'` to the `nav:` section.

- [ ] **Step 2: Add season keys to fr.ts**

Mirror the same structure in `front/app/i18n/locales/fr.ts`:

```typescript
season: {
  current: 'Saison {number}',
  offSeason: 'Hors-saison',
  bans: {
    title: 'Bans de saison',
    comingSoon: 'Bientôt disponible',
  },
  admin: {
    title: 'Saisons',
    createButton: 'Créer une saison',
    numberLabel: 'Numéro de saison',
    numberPlaceholder: 'ex. 64',
    activateButton: 'Activer',
    deactivateButton: 'Désactiver',
    active: 'Active',
    inactive: 'Inactive',
    createSuccess: 'Saison créée',
    activateSuccess: 'Saison activée',
    deactivateSuccess: 'Saison désactivée',
    createError: 'Échec de la création',
    activateError: "Échec de l'activation",
    deactivateError: 'Échec de la désactivation',
  },
},
```

Also add `seasons: 'Saisons'` to the `nav:` section.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd front && npm run build 2>&1 | tail -20
```

Expected: no type errors related to i18n.

- [ ] **Step 4: Commit**

```bash
git add front/app/i18n/locales/en.ts front/app/i18n/locales/fr.ts
git commit -m "feat: add season i18n keys (en + fr)"
```

---

## Task 11 — Frontend season service

**Files:**
- Create: `front/app/services/season.ts`

- [ ] **Step 1: Create the service**

```typescript
// front/app/services/season.ts
const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export interface Season {
  id: string;
  number: number;
  is_active: boolean;
}

export async function getCurrentSeason(): Promise<Season | null> {
  const res = await fetch(`${PROXY}/seasons/current`, { headers: jsonHeaders });
  if (!res.ok) return null;
  return res.json();
}

export async function listSeasons(): Promise<Season[]> {
  const res = await fetch(`${PROXY}/admin/seasons`, { headers: jsonHeaders });
  if (!res.ok) throw new Error('Failed to load seasons');
  return res.json();
}

export async function createSeason(number: number): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ number }),
  });
  if (!res.ok) throw new Error('Failed to create season');
  return res.json();
}

export async function activateSeason(id: string): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons/${id}/activate`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to activate season');
  return res.json();
}

export async function deactivateSeason(id: string): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons/${id}/deactivate`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to deactivate season');
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add front/app/services/season.ts
git commit -m "feat: add frontend season service"
```

---

## Task 12 — SeasonBanner component + war-content integration

**Files:**
- Create: `front/app/game/war/_components/season-banner.tsx`
- Modify: `front/app/game/war/_components/war-content.tsx`

- [ ] **Step 1: Create SeasonBanner**

```tsx
// front/app/game/war/_components/season-banner.tsx
'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { getCurrentSeason, type Season } from '@/app/services/season';
import { Badge } from '@/components/ui/badge';

export default function SeasonBanner() {
  const { t } = useI18n();
  const [season, setSeason] = useState<Season | null | undefined>(undefined);

  useEffect(() => {
    getCurrentSeason().then(setSeason).catch(() => setSeason(null));
  }, []);

  if (season === undefined) return null;

  return (
    <div className="flex items-center gap-2" data-cy="season-banner">
      {season ? (
        <Badge className="bg-green-600 text-white hover:bg-green-600" data-cy="season-active-badge">
          {t.season.current.replace('{number}', String(season.number))}
        </Badge>
      ) : (
        <Badge variant="secondary" data-cy="season-off-season-badge">
          {t.season.offSeason}
        </Badge>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add SeasonBanner to war-content.tsx**

In `front/app/game/war/_components/war-content.tsx`, import the component:

```tsx
import SeasonBanner from './season-banner';
```

Then find the JSX section where `<WarHeader .../>` or the main layout starts, and add `<SeasonBanner />` right after the `<WarHeader ... />` line (or before the management bar if there is no header):

```tsx
<WarHeader ... />
<SeasonBanner />
```

- [ ] **Step 3: Build to verify no TS errors**

```bash
cd front && npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add front/app/game/war/_components/season-banner.tsx front/app/game/war/_components/war-content.tsx
git commit -m "feat: add season banner to war page"
```

---

## Task 13 — Season bans placeholder

**Files:**
- Create: `front/app/game/war/_components/season-bans-placeholder.tsx`
- Modify: `front/app/game/war/_components/war-content.tsx`

- [ ] **Step 1: Create the placeholder component**

```tsx
// front/app/game/war/_components/season-bans-placeholder.tsx
'use client';

import { useI18n } from '@/app/i18n';

export default function SeasonBansPlaceholder() {
  const { t } = useI18n();
  // TODO: implement season-wide ban management (display + enforce banned champions for the season)
  return (
    <div
      data-cy="season-bans-section"
      className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground"
    >
      <p className="font-medium mb-1">{t.season.bans.title}</p>
      <p>{t.season.bans.comingSoon}</p>
    </div>
  );
}
```

- [ ] **Step 2: Add to war-content.tsx**

Import and place the placeholder below the `<SeasonBanner />`:

```tsx
import SeasonBansPlaceholder from './season-bans-placeholder';
```

Place it in the JSX near the season banner or in the war info section:

```tsx
<SeasonBanner />
<SeasonBansPlaceholder />
```

- [ ] **Step 3: Build to verify**

```bash
cd front && npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add front/app/game/war/_components/season-bans-placeholder.tsx front/app/game/war/_components/war-content.tsx
git commit -m "feat: add season bans placeholder to war page"
```

---

## Task 14 — Admin seasons panel

**Files:**
- Create: `front/app/admin/_components/seasons-panel.tsx`
- Modify: `front/app/admin/_viewmodels/use-admin-viewmodel.ts`
- Modify: `front/app/admin/_components/admin-content.tsx`

- [ ] **Step 1: Create seasons-panel.tsx**

```tsx
// front/app/admin/_components/seasons-panel.tsx
'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listSeasons,
  createSeason,
  activateSeason,
  deactivateSeason,
  type Season,
} from '@/app/services/season';

export default function SeasonsPanel() {
  const { t } = useI18n();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setSeasons(await listSeasons());
    } catch {
      setError(t.season.admin.createError);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const n = parseInt(newNumber, 10);
    if (isNaN(n)) return;
    try {
      await createSeason(n);
      setNewNumber('');
      await load();
    } catch {
      setError(t.season.admin.createError);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateSeason(id);
      await load();
    } catch {
      setError(t.season.admin.activateError);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateSeason(id);
      await load();
    } catch {
      setError(t.season.admin.deactivateError);
    }
  };

  return (
    <div className="mt-6 space-y-4" data-cy="seasons-panel">
      <h2 className="text-lg font-semibold">{t.season.admin.title}</h2>

      <div className="flex gap-2 items-center">
        <Input
          type="number"
          placeholder={t.season.admin.numberPlaceholder}
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          className="w-32"
          data-cy="season-number-input"
        />
        <Button onClick={handleCreate} data-cy="create-season-btn">
          {t.season.admin.createButton}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="space-y-2">
        {seasons.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-md border px-4 py-2"
            data-cy={`season-row-${s.number}`}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">Season {s.number}</span>
              <Badge
                variant={s.is_active ? 'default' : 'secondary'}
                className={s.is_active ? 'bg-green-600 text-white hover:bg-green-600' : ''}
                data-cy={s.is_active ? 'season-active-indicator' : 'season-inactive-indicator'}
              >
                {s.is_active ? t.season.admin.active : t.season.admin.inactive}
              </Badge>
            </div>
            <div className="flex gap-2">
              {!s.is_active && (
                <Button
                  size="sm"
                  onClick={() => handleActivate(s.id)}
                  data-cy={`activate-season-${s.number}`}
                >
                  {t.season.admin.activateButton}
                </Button>
              )}
              {s.is_active && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeactivate(s.id)}
                  data-cy={`deactivate-season-${s.number}`}
                >
                  {t.season.admin.deactivateButton}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Seasons to AdminTab enum**

In `front/app/admin/_viewmodels/use-admin-viewmodel.ts`, add `Seasons` to the enum:

```typescript
export enum AdminTab {
  Users = 'users',
  Champions = 'champions',
  Seasons = 'seasons',
}
```

- [ ] **Step 3: Wire Seasons tab in admin-content.tsx**

In `front/app/admin/_components/admin-content.tsx`:

Add import:
```tsx
import SeasonsPanel from './seasons-panel';
```

Update the tabs array:
```tsx
const tabs: TabItem<AdminTab>[] = [
  { value: AdminTab.Users, label: t.nav.users },
  { value: AdminTab.Champions, label: t.nav.champions },
  { value: AdminTab.Seasons, label: t.nav.seasons },
];
```

Add the panel render:
```tsx
{vm.activeTab === AdminTab.Seasons && <SeasonsPanel />}
```

- [ ] **Step 4: Build to verify**

```bash
cd front && npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add front/app/admin/_components/seasons-panel.tsx \
        front/app/admin/_viewmodels/use-admin-viewmodel.ts \
        front/app/admin/_components/admin-content.tsx
git commit -m "feat: add admin seasons management panel"
```

---

## Task 15 — E2E tests

**Files:**
- Create: `front/cypress/e2e/war/season.cy.ts`

- [ ] **Step 1: Write the E2E tests**

```typescript
// front/cypress/e2e/war/season.cy.ts
import { setupWarOwner, setupAdmin } from '../../support/e2e';

describe('Season system', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows off-season badge on war page when no active season', () => {
    setupWarOwner('season-off', 'OffOwner', 'OffAlliance', 'OF').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'OffEnemy');
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('season-off-season-badge').should('be.visible').and('contain', 'Off-season');
    });
  });

  it('shows active season badge on war page when season is active', () => {
    setupAdmin('season-active-token').then(({ adminToken, adminUserId }) => {
      // Create and activate season 64
      cy.request({
        method: 'POST',
        url: '/api/back/admin/seasons',
        body: { number: 64 },
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((res) => {
        const seasonId = res.body.id;
        cy.request({
          method: 'PATCH',
          url: `/api/back/admin/seasons/${seasonId}/activate`,
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      });

      cy.apiLogin(adminUserId);
      cy.navTo('war');
      cy.getByCy('season-active-badge').should('be.visible').and('contain', 'Season 64');
    });
  });

  it('shows season bans placeholder section', () => {
    setupWarOwner('season-bans', 'BansOwner', 'BansAlliance', 'BN').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'BansEnemy');
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('season-bans-section').should('be.visible');
      cy.getByCy('season-bans-section').should('contain', 'Season bans');
      cy.getByCy('season-bans-section').should('contain', 'Coming soon');
    });
  });

  it('admin can create and activate a season from admin panel', () => {
    setupAdmin('season-admin-token').then(({ adminToken, adminUserId }) => {
      cy.apiLogin(adminUserId);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('seasons-panel').should('be.visible');
      cy.getByCy('season-number-input').type('99');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-99').should('be.visible');
      cy.getByCy(`activate-season-99`).click();
      cy.getByCy('season-active-indicator').should('be.visible');
    });
  });

  it('admin can deactivate a season', () => {
    setupAdmin('season-deact-token').then(({ adminToken, adminUserId }) => {
      cy.request({
        method: 'POST',
        url: '/api/back/admin/seasons',
        body: { number: 55 },
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((res) => {
        cy.request({
          method: 'PATCH',
          url: `/api/back/admin/seasons/${res.body.id}/activate`,
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      });

      cy.apiLogin(adminUserId);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('deactivate-season-55').click();
      cy.getByCy('season-inactive-indicator').should('be.visible');
    });
  });
});
```

- [ ] **Step 2: Run the E2E tests**

Use the `/test-e2e` skill with `spec_files=["war/season.cy.ts"]`.

Expected: all 5 tests pass.

- [ ] **Step 3: Run full backend lint check**

```bash
cd api && uvx ruff check src/
```

Expected: no issues.

- [ ] **Step 4: Commit**

```bash
git add front/cypress/e2e/war/season.cy.ts
git commit -m "test: add season E2E tests"
```

---

## Self-review checklist

- [x] Season model created with `number` (unique) + `is_active`
- [x] Migration covers both `season` table and `war.season_id` column
- [x] `WarService.create_war` auto-links active season (or null)
- [x] `WarResponse` exposes `season_id` + `season_number`
- [x] Admin endpoints: create, list, activate, deactivate
- [x] Public endpoint: `/seasons/current`
- [x] i18n keys in both en.ts and fr.ts
- [x] Season banner with green/grey badge + `data-cy` attributes
- [x] Season bans placeholder with TODO comment
- [x] Admin seasons panel: create, activate, deactivate flows
- [x] Unit tests for DTO validation
- [x] Integration tests for all season endpoints + war season link
- [x] E2E tests for all user-facing flows
- [x] TODOs: Approach B dates, time remaining, ban enforcement
