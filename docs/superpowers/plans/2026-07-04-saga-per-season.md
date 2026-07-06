# Saga classification per season — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move champion saga attacker/defender classification from a global property on `Champion` to a per-season binding, resolved against the current war season.

**Architecture:** New `champion_saga_role` join table `(season_id, champion_id, is_saga_attacker, is_saga_defender)`. A `SagaService` resolves the current season's roles into a `{champion_id: (att, def)}` dict. Read controllers apply that dict onto their response DTOs; admin edits it per chosen season. The two boolean columns are dropped from `champion` (data loss accepted).

**Tech Stack:** FastAPI, SQLModel, MariaDB (async), Alembic, Next.js/React 19, Tailwind 4, shadcn/ui.

## Global Constraints

- Backend commands run via the `/make` skill — never raw `pytest`/`alembic`/`uvicorn`.
- Migrations via the `/db-migrate` skill — always `make reset-db` before `make create-mig` / `make migrate`. Migration message required.
- Lint at end of every backend session: `uvx ruff check`; format: `uvx ruff format`.
- E2E via the `/test-e2e` skill only — never call `mcp__cypress-runner__run_parallel` directly.
- Async/await + `AsyncSession`; `selectinload()` for relationships (no lazy loading); raise `HTTPException` for errors.
- i18n: `useI18n()` always; add every new key to both `front/app/i18n/locales/en.ts` and `fr.ts`.
- Frontend: never modify `components/ui/` directly; Tailwind semantic tokens; `data-cy` for E2E.
- "Current season" = `SeasonService.get_current_season()` → the single non-ended season (upcoming wins over active). May be `None`.
- After edits, run `npm run build` in `front/` to catch TS errors.

---

## File Structure

**Backend — create**
- `api/src/models/ChampionSagaRole.py` — join model.
- `api/src/services/admin/SagaService.py` — resolution + upsert.
- `api/src/dto/admin/dto_saga.py` — request/response DTOs for saga endpoints.
- `api/src/controllers/admin/saga_controller.py` — admin saga endpoints (or add to `season_controller.py`; this plan adds to `season_controller.py`).
- Tests under `api/tests/unit/` and `api/tests/integration/endpoints/`.

**Backend — modify**
- `api/src/models/Champion.py` — drop 2 bool columns, add `saga_roles` relationship.
- `api/src/models/Season.py` — add `saga_roles` relationship.
- `api/src/models/__init__.py` — register `ChampionSagaRole`.
- `api/src/services/admin/ChampionService.py` — remove `toggle_saga_*`, remove saga from `_apply_filters` + load/export.
- `api/src/controllers/admin/champion_controller.py` — remove saga toggle routes, saga query params, saga in export/response.
- `api/src/dto/admin/dto_champion.py` — remove saga fields.
- `api/src/dto/account/game/dto_champion_user.py`, `api/src/dto/alliance/dto_alliance_roster.py`, `api/src/dto/alliance/war/dto_defense.py` — remove saga reads from validators (keep the response fields).
- `api/src/controllers/account/game/champion_user_controller.py`, `api/src/controllers/alliance/alliance_roster_controller.py`, `api/src/controllers/alliance/war/defense_controller.py` — inject saga dict.
- Every `WarFightRecord(...)` / `WarFightRecordImport(...)` construction that sets `is_saga_attacker` / `defender_is_saga_defender` (at minimum `api/src/controllers/dev_controller.py`).

**Frontend — create**
- `front/app/components/season-select.tsx` — shared season dropdown.

**Frontend — modify**
- `front/app/services/champions.ts` — season-scoped saga API; drop global toggles + saga from `Champion` type / export / filters.
- `front/app/admin/_components/champions-panel.tsx` + `front/app/admin/champions/_components/champion-table-row.tsx` — season dropdown, season-scoped toggles, remove global saga filters.
- `front/app/game/knowledge-base/_components/knowledge-base-filters.tsx` — reuse the shared `SeasonSelect`.
- `front/app/i18n/locales/en.ts` & `fr.ts` — new keys.
- E2E specs under `front/cypress/e2e/`.

---

## Task 1: `ChampionSagaRole` model + drop `Champion` saga columns

**Files:**
- Create: `api/src/models/ChampionSagaRole.py`
- Modify: `api/src/models/Champion.py`, `api/src/models/Season.py`, `api/src/models/__init__.py`
- Test: `api/tests/unit/models/champion_saga_role_test.py`

**Interfaces:**
- Produces: `ChampionSagaRole(id, season_id, champion_id, is_saga_attacker, is_saga_defender)`, table `champion_saga_role`, unique `(season_id, champion_id)`.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/unit/models/champion_saga_role_test.py
from src.models.ChampionSagaRole import ChampionSagaRole


def test_champion_saga_role_defaults():
    role = ChampionSagaRole(season_id=None, champion_id=None)
    assert role.is_saga_attacker is False
    assert role.is_saga_defender is False


def test_champion_has_no_global_saga_fields():
    from src.models.Champion import Champion
    assert not hasattr(Champion(name="x", champion_class="Cosmic"), "is_saga_attacker")
    assert not hasattr(Champion(name="x", champion_class="Cosmic"), "is_saga_defender")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/make` → `make test` scoped, e.g. `uv run pytest tests/unit/models/champion_saga_role_test.py -v`
Expected: FAIL — `ModuleNotFoundError: ChampionSagaRole` / champion still has the attributes.

- [ ] **Step 3: Create the model**

```python
# api/src/models/ChampionSagaRole.py
import uuid
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, UniqueConstraint

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.Season import Season


class ChampionSagaRole(UUIDBase, table=True):
    __tablename__ = "champion_saga_role"
    __table_args__ = (UniqueConstraint("season_id", "champion_id", name="uq_saga_season_champion"),)

    season_id: uuid.UUID = Field(foreign_key="season.id", index=True, ondelete="CASCADE")
    champion_id: uuid.UUID = Field(foreign_key="champion.id", index=True, ondelete="CASCADE")
    is_saga_attacker: bool = Field(default=False)
    is_saga_defender: bool = Field(default=False)

    champion: Optional["Champion"] = Relationship(back_populates="saga_roles")
    season: Optional["Season"] = Relationship(back_populates="saga_roles")
```

- [ ] **Step 4: Update `Champion.py`** — remove the two saga bool lines, add the relationship import + field.

```python
# api/src/models/Champion.py
from typing import List, Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.ChampionUser import ChampionUser
    from src.models.ChampionSagaRole import ChampionSagaRole


class Champion(UUIDBase, table=True):
    __tablename__ = "champion"

    name: str = Field(max_length=100, unique=True)
    champion_class: str = Field(max_length=20)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_7_star: bool = Field(default=False)
    is_ascendable: bool = Field(default=False)
    has_prefight: bool = Field(default=False)
    alias: Optional[str] = Field(default=None, max_length=500)

    # Relations
    instances: List["ChampionUser"] = Relationship(back_populates="champion")
    saga_roles: List["ChampionSagaRole"] = Relationship(
        back_populates="champion", cascade_delete=True
    )
```

- [ ] **Step 5: Update `Season.py`** — add `saga_roles` relationship (mirror the existing import/relationship style in that file).

```python
# add near the top imports (guarded)
from typing import TYPE_CHECKING, List
from sqlmodel import Relationship
if TYPE_CHECKING:
    from src.models.ChampionSagaRole import ChampionSagaRole

# add inside class Season(...)
    saga_roles: List["ChampionSagaRole"] = Relationship(
        back_populates="season", cascade_delete=True
    )
```

- [ ] **Step 6: Register in `models/__init__.py`** — add next to the other model imports:

```python
from src.models.ChampionSagaRole import ChampionSagaRole  # noqa: F401
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `uv run pytest tests/unit/models/champion_saga_role_test.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/src/models/ChampionSagaRole.py api/src/models/Champion.py api/src/models/Season.py api/src/models/__init__.py api/tests/unit/models/champion_saga_role_test.py
git commit -m "feat: add ChampionSagaRole model, drop global saga fields from Champion"
```

---

## Task 2: `SagaService`

**Files:**
- Create: `api/src/services/admin/SagaService.py`
- Test: `api/tests/unit/services/saga_service_test.py`

**Interfaces:**
- Consumes: `SeasonService.get_current_season`, `ChampionSagaRole`.
- Produces:
  - `SagaService.get_roles_for_season(session, season_id: uuid.UUID) -> dict[uuid.UUID, tuple[bool, bool]]`
  - `SagaService.resolve_current(session) -> dict[uuid.UUID, tuple[bool, bool]]`
  - `SagaService.upsert_role(session, season_id, champion_id, is_saga_attacker, is_saga_defender) -> ChampionSagaRole`

- [ ] **Step 1: Write the failing test**

```python
# api/tests/unit/services/saga_service_test.py
import uuid
import pytest
from src.services.admin.SagaService import SagaService
from src.services.admin.SeasonService import SeasonService
from src.models.Champion import Champion
from src.enums.SeasonFormat import SeasonFormat


@pytest.mark.asyncio
async def test_upsert_then_resolve_current(session):
    champ = Champion(name="Hulk", champion_class="Science")
    session.add(champ)
    season = await SeasonService.create_season(session, number=42, format=SeasonFormat.regular)
    await session.commit()

    await SagaService.upsert_role(session, season.id, champ.id, True, False)
    roles = await SagaService.resolve_current(session)
    assert roles[champ.id] == (True, False)

    # update path
    await SagaService.upsert_role(session, season.id, champ.id, True, True)
    roles = await SagaService.resolve_current(session)
    assert roles[champ.id] == (True, True)


@pytest.mark.asyncio
async def test_resolve_current_empty_without_season(session):
    assert await SagaService.resolve_current(session) == {}
```

Note: use the project's existing async DB `session` fixture (see other tests in `api/tests/unit/services/`); match its name.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/services/saga_service_test.py -v`
Expected: FAIL — `SagaService` undefined.

- [ ] **Step 3: Implement the service**

```python
# api/src/services/admin/SagaService.py
import uuid

from sqlmodel import select

from src.models.ChampionSagaRole import ChampionSagaRole
from src.services.admin.SeasonService import SeasonService
from src.utils.db import SessionDep


class SagaService:
    @classmethod
    async def get_roles_for_season(
        cls, session: SessionDep, season_id: uuid.UUID
    ) -> dict[uuid.UUID, tuple[bool, bool]]:
        result = await session.exec(
            select(ChampionSagaRole).where(ChampionSagaRole.season_id == season_id)
        )
        return {
            r.champion_id: (r.is_saga_attacker, r.is_saga_defender) for r in result.all()
        }

    @classmethod
    async def resolve_current(
        cls, session: SessionDep
    ) -> dict[uuid.UUID, tuple[bool, bool]]:
        season = await SeasonService.get_current_season(session)
        if season is None:
            return {}
        return await cls.get_roles_for_season(session, season.id)

    @classmethod
    async def upsert_role(
        cls,
        session: SessionDep,
        season_id: uuid.UUID,
        champion_id: uuid.UUID,
        is_saga_attacker: bool,
        is_saga_defender: bool,
    ) -> ChampionSagaRole:
        result = await session.exec(
            select(ChampionSagaRole).where(
                ChampionSagaRole.season_id == season_id,
                ChampionSagaRole.champion_id == champion_id,
            )
        )
        role = result.first()
        if role is None:
            role = ChampionSagaRole(season_id=season_id, champion_id=champion_id)
        role.is_saga_attacker = is_saga_attacker
        role.is_saga_defender = is_saga_defender
        session.add(role)
        await session.commit()
        await session.refresh(role)
        return role
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/unit/services/saga_service_test.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/admin/SagaService.py api/tests/unit/services/saga_service_test.py
git commit -m "feat: add SagaService for per-season saga resolution and upsert"
```

---

## Task 3: Admin saga endpoints + remove global toggle endpoints

**Files:**
- Create: `api/src/dto/admin/dto_saga.py`
- Modify: `api/src/controllers/admin/season_controller.py`
- Modify: `api/src/services/admin/ChampionService.py` (remove `toggle_saga_attacker`, `toggle_saga_defender`)
- Modify: `api/src/controllers/admin/champion_controller.py` (remove the two `/{id}/saga-attacker` and `/{id}/saga-defender` routes and saga query params)
- Modify: `api/src/dto/admin/dto_champion.py` (remove `is_saga_attacker` / `is_saga_defender` fields)
- Test: `api/tests/integration/endpoints/saga_endpoints_test.py`

**Interfaces:**
- Consumes: `SagaService.upsert_role`, `SagaService.get_roles_for_season`.
- Produces:
  - `GET  /admin/seasons/{season_id}/saga` → `list[SagaRoleResponse]`
  - `PUT  /admin/seasons/{season_id}/saga/{champion_id}` body `SagaRoleUpsertRequest` → `SagaRoleResponse`

- [ ] **Step 1: Write the failing integration test**

```python
# api/tests/integration/endpoints/saga_endpoints_test.py
import pytest


@pytest.mark.asyncio
async def test_admin_upsert_and_list_saga(admin_client, seed_season, seed_champion):
    season_id = seed_season.id
    champ_id = seed_champion.id

    r = await admin_client.put(
        f"/admin/seasons/{season_id}/saga/{champ_id}",
        json={"is_saga_attacker": True, "is_saga_defender": False},
    )
    assert r.status_code == 200
    assert r.json()["is_saga_attacker"] is True

    r = await admin_client.get(f"/admin/seasons/{season_id}/saga")
    assert r.status_code == 200
    body = r.json()
    assert any(row["champion_id"] == str(champ_id) and row["is_saga_attacker"] for row in body)
```

Note: reuse the project's existing admin client + seed fixtures from `api/tests/integration/`; match their real names (grep `conftest.py`).

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integration/endpoints/saga_endpoints_test.py -v`
Expected: FAIL — 404 (routes not defined).

- [ ] **Step 3: Create the DTOs**

```python
# api/src/dto/admin/dto_saga.py
import uuid

from pydantic import BaseModel, ConfigDict


class SagaRoleUpsertRequest(BaseModel):
    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class SagaRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    season_id: uuid.UUID
    champion_id: uuid.UUID
    is_saga_attacker: bool
    is_saga_defender: bool
```

- [ ] **Step 4: Add routes to `season_controller.py`**

Add imports at top:

```python
from src.dto.admin.dto_saga import SagaRoleResponse, SagaRoleUpsertRequest
from src.services.admin.SagaService import SagaService
```

Add routes on `season_admin_controller`:

```python
@season_admin_controller.get("/{season_id}/saga", response_model=list[SagaRoleResponse])
async def list_saga_roles(season_id: uuid.UUID, session: SessionDep):
    """List champion saga roles for a season. Admin only."""
    roles = await SagaService.get_roles_for_season(session, season_id)
    return [
        SagaRoleResponse(
            season_id=season_id,
            champion_id=champion_id,
            is_saga_attacker=att,
            is_saga_defender=dfn,
        )
        for champion_id, (att, dfn) in roles.items()
    ]


@season_admin_controller.put(
    "/{season_id}/saga/{champion_id}", response_model=SagaRoleResponse
)
async def upsert_saga_role(
    season_id: uuid.UUID,
    champion_id: uuid.UUID,
    body: SagaRoleUpsertRequest,
    session: SessionDep,
):
    """Set a champion's saga attacker/defender flags for a season. Admin only."""
    return await SagaService.upsert_role(
        session, season_id, champion_id, body.is_saga_attacker, body.is_saga_defender
    )
```

- [ ] **Step 5: Remove `toggle_saga_attacker` / `toggle_saga_defender`** from `ChampionService.py` and their two routes from `champion_controller.py`. Remove `is_saga_attacker` / `is_saga_defender` from: `champion_controller` query params + response dict (lines ~54-55, 65-66, 112, 124), and from `dto_champion.py` create/update/response/load DTOs.

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/integration/endpoints/saga_endpoints_test.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/src/dto/admin/dto_saga.py api/src/controllers/admin/season_controller.py api/src/services/admin/ChampionService.py api/src/controllers/admin/champion_controller.py api/src/dto/admin/dto_champion.py api/tests/integration/endpoints/saga_endpoints_test.py
git commit -m "feat: add per-season saga admin endpoints, remove global saga toggles"
```

---

## Task 4: Inject current-season saga into read DTOs

**Files:**
- Modify validators (remove saga reads): `api/src/dto/account/game/dto_champion_user.py`, `api/src/dto/alliance/dto_alliance_roster.py`, `api/src/dto/alliance/war/dto_defense.py`
- Modify controllers (apply saga dict): `api/src/controllers/account/game/champion_user_controller.py`, `api/src/controllers/alliance/alliance_roster_controller.py`, `api/src/controllers/alliance/war/defense_controller.py`
- Test: `api/tests/integration/endpoints/roster_saga_test.py`

**Interfaces:**
- Consumes: `SagaService.resolve_current`.
- The three response models keep `is_saga_attacker` / `is_saga_defender` fields (default `False`); their `model_validator` no longer reads `champion.is_saga_*`. Controllers set the values post-validation.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/integration/endpoints/roster_saga_test.py
import pytest


@pytest.mark.asyncio
async def test_roster_reflects_current_season_saga(
    user_client, admin_client, seed_current_season, seed_account_with_champion
):
    season_id = seed_current_season.id
    account_id, champ_id = seed_account_with_champion

    await admin_client.put(
        f"/admin/seasons/{season_id}/saga/{champ_id}",
        json={"is_saga_attacker": True, "is_saga_defender": False},
    )

    r = await user_client.get(f"/champion-users/by-account/{account_id}")
    assert r.status_code == 200
    entry = next(e for e in r.json() if e["champion_id"] == str(champ_id))
    assert entry["is_saga_attacker"] is True
    assert entry["is_saga_defender"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integration/endpoints/roster_saga_test.py -v`
Expected: FAIL — `champion.is_saga_attacker` attribute error in the validator (or always `False`).

- [ ] **Step 3: Remove saga reads from the three validators**

In each of the three DTOs, delete the two dict lines:
```python
"is_saga_attacker": data.champion.is_saga_attacker,
"is_saga_defender": data.champion.is_saga_defender,
```
(in `dto_defense.py` the source is `data.champion_user.champion.*`). Leave the response-model fields (`is_saga_attacker: bool = False`) in place.

- [ ] **Step 4: Apply the saga dict in the three controllers**

`champion_user_controller.py` — replace both `return [ChampionUserDetailResponse.model_validate(e) for e in entries]` sites with:

```python
from src.services.admin.SagaService import SagaService  # top of file

    saga = await SagaService.resolve_current(session)
    responses = [ChampionUserDetailResponse.model_validate(e) for e in entries]
    for dto, e in zip(responses, entries):
        att, dfn = saga.get(e.champion_id, (False, False))
        dto.is_saga_attacker, dto.is_saga_defender = att, dfn
    return responses
```

`alliance_roster_controller.py:31` — same pattern (`e.champion_id`), `AllianceRosterEntryResponse`.

`defense_controller.py` — in `_to_placement_response` the entity is a placement; use `p.champion_user.champion_id`. Make it apply the dict:

```python
def _to_placement_response(p, saga: dict) -> DefensePlacementResponse:
    dto = DefensePlacementResponse.model_validate(p)
    att, dfn = saga.get(p.champion_user.champion_id, (False, False))
    dto.is_saga_attacker, dto.is_saga_defender = att, dfn
    return dto
```
and at each call site resolve once: `saga = await SagaService.resolve_current(session)` then pass it in. Verify `champion_user.champion_id` is loaded (add to the existing `selectinload` chain if needed).

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/integration/endpoints/roster_saga_test.py -v`
Expected: PASS. Also run the existing roster/defense endpoint tests to confirm no regression.

- [ ] **Step 6: Commit**

```bash
git add api/src/dto/account/game/dto_champion_user.py api/src/dto/alliance/dto_alliance_roster.py api/src/dto/alliance/war/dto_defense.py api/src/controllers/account/game/champion_user_controller.py api/src/controllers/alliance/alliance_roster_controller.py api/src/controllers/alliance/war/defense_controller.py api/tests/integration/endpoints/roster_saga_test.py
git commit -m "feat: resolve roster/defense saga flags from current season"
```

---

## Task 5: WarFightRecord saga snapshot from record's season

**Files:**
- Modify: every `WarFightRecord(...)` / `WarFightRecordImport(...)` construction that sets `is_saga_attacker` / `defender_is_saga_defender` (at minimum `api/src/controllers/dev_controller.py:~470`).
- Test: extend the relevant fight-record test (or add `api/tests/integration/endpoints/fight_record_saga_test.py`).

**Interfaces:**
- Consumes: `SagaService.get_roles_for_season(session, season_id)` — use the record's `season_id`, not the current season.

- [ ] **Step 1: Locate all construction sites**

Run: `grep -rn 'is_saga_attacker=\|defender_is_saga_defender=' api/src`
Expected: the `dev_controller.py` bulk endpoint, plus any real war-end / import service. Handle each.

- [ ] **Step 2: Write the failing test** — assert a created war fight record's `is_saga_attacker` matches the saga role set for that record's season (not the champion). Model it on the existing fight-record test fixtures.

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/integration/endpoints/fight_record_saga_test.py -v`
Expected: FAIL — `champion.is_saga_attacker` no longer exists / value wrong.

- [ ] **Step 4: Source the snapshot from the season roles**

In `dev_controller.py`, before the loop:
```python
from src.services.admin.SagaService import SagaService
    saga = await SagaService.get_roles_for_season(session, body.season_id)
```
Then replace:
```python
            is_saga_attacker=saga.get(atk.id, (False, False))[0],
            ...
            defender_is_saga_defender=saga.get(dfn.id, (False, False))[1],
```
Apply the same substitution at every other construction site, using that record's own `season_id`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/integration/endpoints/fight_record_saga_test.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A api/src api/tests
git commit -m "feat: snapshot war-record saga flags from the record's season"
```

---

## Task 6: Alembic migration

**Files:**
- Create: migration file under `api/alembic/versions/` (auto-generated).

- [ ] **Step 1: Run the migration skill**

Use `/db-migrate` with `MESSAGE="saga_per_season"`. It runs `make reset-db` then `make create-mig MESSAGE="saga_per_season"`.

- [ ] **Step 2: Review the generated migration**

Expected upgrade operations:
- `create_table("champion_saga_role", ...)` with FKs to `season.id` and `champion.id` (both `ondelete="CASCADE"`), unique `(season_id, champion_id)`, indexes on both FKs.
- `drop_column("champion", "is_saga_attacker")` and `drop_column("champion", "is_saga_defender")`.

If autogenerate misses the CASCADE / unique constraint, add them by hand.

- [ ] **Step 3: Apply and verify**

The skill applies via `make migrate`. Confirm the table exists and the two columns are gone.

- [ ] **Step 4: Commit**

```bash
git add api/alembic/versions/
git commit -m "feat: migration for champion_saga_role, drop champion saga columns"
```

---

## Task 7: Shared `SeasonSelect` component

**Files:**
- Create: `front/app/components/season-select.tsx`
- Modify: `front/app/game/knowledge-base/_components/knowledge-base-filters.tsx`
- Test: E2E covered in Task 11.

**Interfaces:**
- Produces: `SeasonSelect` — props `{ seasons: {id: string; number: number}[]; value: string | null; onChange: (seasonId: string) => void; 'data-cy'?: string }`. Uses shadcn `Select`.

- [ ] **Step 1: Read the existing inline selector**

Open `knowledge-base-filters.tsx` and locate the season `Select` block wired via `onSeasonIdChange`. Note its exact markup + i18n labels.

- [ ] **Step 2: Create the shared component** — extract that markup verbatim into `season-select.tsx`, parameterised by the interface above, keeping the shadcn `Select`, semantic tokens, and a `data-cy` passthrough.

- [ ] **Step 3: Reuse it in knowledge-base-filters** — replace the inline block with `<SeasonSelect seasons={...} value={...} onChange={onSeasonIdChange} data-cy='kb-season-select' />`. Keep behaviour identical.

- [ ] **Step 4: Verify build + no visual regression**

Run: `cd front && npm run build`
Expected: PASS. Manually confirm the knowledge-base season filter still works.

- [ ] **Step 5: Commit**

```bash
git add front/app/components/season-select.tsx front/app/game/knowledge-base/_components/knowledge-base-filters.tsx
git commit -m "refactor: extract shared SeasonSelect, reuse in knowledge-base"
```

---

## Task 8: `champions.ts` — season-scoped saga API

**Files:**
- Modify: `front/app/services/champions.ts`

**Interfaces:**
- Produces:
  - `getSeasonSagaRoles(seasonId: string): Promise<{champion_id: string; is_saga_attacker: boolean; is_saga_defender: boolean}[]>`
  - `setChampionSagaRole(seasonId: string, championId: string, body: {is_saga_attacker: boolean; is_saga_defender: boolean}): Promise<{is_saga_attacker: boolean; is_saga_defender: boolean}>`
- Removes: `toggleChampionSagaAttacker`, `toggleChampionSagaDefender`; `is_saga_attacker`/`is_saga_defender` from `Champion` interface, from `getChampions` filter params, from `exportAllChampions` / `loadChampions` mappings.

- [ ] **Step 1: Remove the two global toggle functions** and the saga fields from the `Champion` interface + export/load/filter code.

- [ ] **Step 2: Add the season-scoped functions**

```typescript
export const getSeasonSagaRoles = async (
  seasonId: string,
): Promise<{ champion_id: string; is_saga_attacker: boolean; is_saga_defender: boolean }[]> => {
  const response = await fetch(`${PROXY}/admin/seasons/${seasonId}/saga`);
  await throwOnError(response, 'Erreur lors du chargement des rôles saga');
  return response.json();
};

export const setChampionSagaRole = async (
  seasonId: string,
  championId: string,
  body: { is_saga_attacker: boolean; is_saga_defender: boolean },
): Promise<{ is_saga_attacker: boolean; is_saga_defender: boolean }> => {
  const response = await fetch(`${PROXY}/admin/seasons/${seasonId}/saga/${championId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await throwOnError(response, 'Erreur lors de la mise à jour du rôle saga');
  return response.json();
};
```

- [ ] **Step 3: Verify build**

Run: `cd front && npm run build`
Expected: TS errors ONLY in `champions-panel.tsx` / `champion-table-row.tsx` (fixed in Task 9). If errors appear elsewhere (roster/defense read components), those consumers were reading `Champion.is_saga_*` directly — they should read the DTO field instead; fix them here.

- [ ] **Step 4: Commit**

```bash
git add front/app/services/champions.ts
git commit -m "feat: season-scoped saga API in champions service"
```

---

## Task 9: Admin champions page — season dropdown + scoped toggles

**Files:**
- Modify: `front/app/admin/_components/champions-panel.tsx`, `front/app/admin/champions/_components/champion-table-row.tsx`

**Interfaces:**
- Consumes: `SeasonSelect` (Task 7), `getSeasonSagaRoles`, `setChampionSagaRole` (Task 8), season list (fetch via existing seasons service or `/admin/seasons`).

- [ ] **Step 1: Add season state + selector** to `champions-panel.tsx`: fetch seasons, default `selectedSeasonId` to the current season (first non-ended, or first in list), render `<SeasonSelect ... data-cy='admin-saga-season-select' />` in the toolbar. On season change, load `getSeasonSagaRoles(selectedSeasonId)` into a `Map<championId, {att, def}>` in state.

- [ ] **Step 2: Rewrite the saga toggle handlers** — `handleToggleSagaAttacker` / `handleToggleSagaDefender` now compute the new value from the season roles map and call `setChampionSagaRole(selectedSeasonId, champion.id, {...})`, then update the map (not the champion list).

- [ ] **Step 3: Remove the global saga filters** (`filterSagaAttacker` / `filterSagaDefender` state, effect deps, reset lines, and the two saga `BoolFilter` UI blocks). The saga columns are now driven by the season roles map, not `champion.is_saga_*`.

- [ ] **Step 4: Update `champion-table-row.tsx`** — the saga cells read `is_saga_attacker` / `is_saga_defender` from props sourced from the season map (add `sagaAttacker: boolean` / `sagaDefender: boolean` props), instead of `champion.is_saga_*`. Keep the `data-cy` attributes (`toggle-saga-attacker-${champion.name}`, `toggle-saga-defender-${champion.name}`).

- [ ] **Step 5: Verify build**

Run: `cd front && npm run build`
Expected: PASS, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add front/app/admin/_components/champions-panel.tsx front/app/admin/champions/_components/champion-table-row.tsx
git commit -m "feat: admin champions saga editing scoped to a selected season"
```

---

## Task 10: i18n keys

**Files:**
- Modify: `front/app/i18n/locales/en.ts`, `front/app/i18n/locales/fr.ts`

- [ ] **Step 1: Add keys to BOTH files** for: saga season selector label/placeholder, and any new admin saga strings. Remove now-unused global saga-filter keys (`sagaAttackerFilter`, `sagaDefenderFilter`) only if no longer referenced.

Run the `/i18n-check` skill to confirm `en.ts` and `fr.ts` stay in sync.

- [ ] **Step 2: Verify build**

Run: `cd front && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add front/app/i18n/locales/en.ts front/app/i18n/locales/fr.ts
git commit -m "feat: i18n keys for per-season saga management"
```

---

## Task 11: E2E

**Files:**
- Create/modify a spec under `front/cypress/e2e/` (e.g. `admin/saga-per-season.cy.ts`).

- [ ] **Step 1: Write the spec** — `beforeEach(() => cy.truncateDb())`. As admin: create a season, load a champion, open the admin champions panel, select the season via `getByCy('admin-saga-season-select')`, toggle `toggle-saga-attacker-<name>`. Then as a user with that champion in roster, assert the roster card shows the saga-attacker indicator. Use setup helpers (`setupAdmin`, `setupRosterUser`) and `cy.apiLoadChampion`.

- [ ] **Step 2: Run via the `/test-e2e` skill**

Pass `spec_files=["admin/saga-per-season.cy.ts"]`.
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add front/cypress/e2e/admin/saga-per-season.cy.ts
git commit -m "test: e2e for per-season saga management"
```

---

## Final: lint + full check

- [ ] Backend: `uvx ruff check` and `uvx ruff format` (via project convention). Run full backend suite via `/make` → `make test`.
- [ ] Frontend: `cd front && npm run build`.
- [ ] Re-run only failing tests after fixes.

---

## Self-Review notes

- **Spec coverage**: data model (T1), resolution service (T2), admin surface (T3), read DTO injection (T4), WarFightRecord snapshot (T5), migration (T6), shared season selector extraction (T7), frontend service + admin UI + i18n (T8–T10), testing (T2/T3/T4/T5/T11). All spec sections mapped.
- **Beyond spec (discovered)**: global saga filters + CSV export/import saga fields on the admin champion list are removed (T3/T8/T9) — they no longer map to a global property. War-record snapshot uses the record's own `season_id` rather than the current season (T5), which is the correct historical semantics.
- **Type consistency**: `resolve_current` / `get_roles_for_season` both return `dict[UUID, tuple[bool, bool]]`; controllers unpack `(att, dfn)`. Frontend `getSeasonSagaRoles` / `setChampionSagaRole` names used consistently in T8–T9.
