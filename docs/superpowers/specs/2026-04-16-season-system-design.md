# Season System Design

**Date:** 2026-04-16  
**Status:** Approved

---

## Context

Mawster is an MCOC alliance war management tool. Alliance wars happen both during official game seasons and outside them (off-season). Admins need to declare the current active season (e.g., "Season 64") so that wars are automatically tagged. When no season is active, wars are considered off-season.

---

## Approach

**Approach A** — `Season` table with `is_active` boolean flag.

> TODO: migrate to Approach B — add `started_at` / `ended_at` columns to automate activation/deactivation based on game calendar dates.

---

## Data Model

### New table: `Season`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `number` | int | Unique, e.g. 64 |
| `is_active` | bool | Default false. Only one row can be true at a time (enforced at service level). |

> TODO (Approach B): add `started_at: datetime` and `ended_at: datetime | null`. Active season = `started_at IS NOT NULL AND ended_at IS NULL`.

### Modified: `War`

- Add nullable FK `season_id → season.id`
- `null` = off-season war
- Set automatically at war creation time to the current active season (or `null` if none)

---

## Backend

### New: `Season` model (`api/src/models/Season.py`)

SQLModel table with `id`, `number`, `is_active`.

### New: `SeasonService` (`api/src/services/SeasonService.py`)

- `get_active_season(session)` → `Season | None`
- `get_all_seasons(session)` → `list[Season]`
- `create_season(session, number)` → `Season` (raises 409 if number already exists)
- `activate_season(session, season_id)` → `Season` (deactivates all others first)
- `deactivate_season(session, season_id)` → `Season`

### New: `SeasonController` (`api/src/controllers/season_controller.py`)

**Admin-only** (`/admin/seasons`):
- `POST /admin/seasons` — create a season `{ number: int }`
- `GET /admin/seasons` — list all seasons
- `PATCH /admin/seasons/{id}/activate` — activate (auto-deactivates previous)
- `PATCH /admin/seasons/{id}/deactivate` — deactivate

**Public** (`/seasons`):
- `GET /seasons/current` — returns active season or `null` (authenticated users)

### Modified: `WarService.create_war`

Fetch active season before inserting, assign its `id` to `war.season_id` (or `None`).

### New DTOs (`api/src/dto/dto_season.py`)

- `SeasonCreateRequest` — `number: int`
- `SeasonResponse` — `id`, `number`, `is_active`

### Alembic migration

- Create `season` table
- Add nullable `season_id` column to `war` table with FK

---

## Frontend

### Season status badge

Displayed on the war/defense page header:

- Active season → green badge `"Saison 64"`
- No active season → grey badge `"Hors-saison"`

> TODO: display time remaining before season end (once Approach B dates are implemented).

### Season bans placeholder

Section visible on the war page:

- Title: `"Bans de saison"`
- Content: `"Bientôt disponible"`

> TODO: implement season-wide ban management (display + enforce banned champions for the active season).

### Admin: Season management page

New section in admin UI:
- List all seasons with status badge
- Button to create a new season (modal with number input)
- Activate / Deactivate buttons per row

### i18n

Add keys to both `en.ts` and `fr.ts`:
- `season.current` → "Saison {number}" / "Season {number}"
- `season.offSeason` → "Hors-saison" / "Off-season"
- `season.bans.title` → "Bans de saison" / "Season bans"
- `season.bans.comingSoon` → "Bientôt disponible" / "Coming soon"
- `season.admin.*` keys for admin UI

---

## Testing

### Pytest (backend)

**Unit tests** (`api/tests/unit/`):
- `SeasonService.create_season` — nominal, duplicate number
- `SeasonService.activate_season` — deactivates previous active season
- `SeasonService.deactivate_season` — nominal

**Integration tests** (`api/tests/integration/endpoints/`):
- `POST /admin/seasons` — 201, 409 duplicate, 403 non-admin
- `PATCH /admin/seasons/{id}/activate` — 200, only one active at a time
- `PATCH /admin/seasons/{id}/deactivate` — 200
- `GET /seasons/current` — returns active or null
- `POST /alliances/{id}/wars` — war.season_id = active season id when season is active, null when off-season

### E2E (Cypress)

- Admin creates a season and activates it → badge "Saison 64" visible on defense page
- Admin deactivates season → badge switches to "Hors-saison"
- "Bans de saison" section visible with "Bientôt disponible" message
- Admin page: create, activate, deactivate flows

---

## Out of scope

- Season ban enforcement (placeholder only)
- Automatic season activation/deactivation by date (Approach B)
- Time remaining display (depends on Approach B dates)
