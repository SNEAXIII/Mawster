# Saga classification per season — design

## Problem

Today a champion's saga role is a **global static property**: `Champion.is_saga_attacker` /
`Champion.is_saga_defender`. In MCOC the saga rotation changes every season (a new saga
takes effect as soon as pre-season starts), so a single global flag can't represent it.
Admins have to manually re-toggle the whole champion list each season.

## Goal

Bind saga attacker/defender classification to a **war season**. Admin picks a season (via a
dropdown, defaulting to the current one) and marks which champions are saga attacker /
defender for that season. All read consumers resolve the classification against the
**current season**.

## Decisions (locked with user)

- **Season entity**: reuse the existing `Season` model (war seasons). New saga = tied to a
  season's pre-season (`SeasonStatus.upcoming`).
- **Resolution**: "current" saga uses `SeasonService.get_current_season()` — `upcoming` wins
  over `active`, matching "dès que c'est la pré-saison, la nouvelle saga".
- **Schema shape**: join table with two booleans (Approach A). A champion can be
  attacker / defender / both / neither in a given season.
- **Migration**: drop the two boolean columns off `champion`. **No backfill — data loss
  accepted.** Champions themselves are kept (columns dropped only, not the table).

## Data model

New model `api/src/models/ChampionSagaRole.py`:

```
ChampionSagaRole(UUIDBase, table=True)
  __tablename__ = "champion_saga_role"
  season_id:   FK -> season.id      (indexed)
  champion_id: FK -> champion.id    (indexed, ON DELETE CASCADE)
  is_saga_attacker: bool = False
  is_saga_defender: bool = False
  UNIQUE(season_id, champion_id)
```

- Relationships both sides for `selectinload` (no lazy loading).
- Drop `is_saga_attacker` / `is_saga_defender` from `Champion`.
- Register in `models/__init__.py`.

## Resolution service

New `api/src/services/admin/SagaService.py`:

- `get_roles_for_season(session, season_id) -> dict[UUID, tuple[bool, bool]]`
  batch-load all `champion_saga_role` rows for a season keyed by `champion_id`.
- `resolve_current(session) -> dict[UUID, tuple[bool, bool]]`
  uses `SeasonService.get_current_season()`; returns `{}` if no current season
  (→ every champion unclassified).
- `upsert_role(session, season_id, champion_id, is_saga_attacker, is_saga_defender)`
  insert or update the join row.

**No N+1**: the service layer that builds a roster/defense list calls `resolve_current`
**once** and passes the dict down to the DTO builders.

## Admin surface

- New endpoints on the season/admin router:
  - `GET  /admin/seasons/{season_id}/saga` → roles for that season (populate table toggles).
  - `PUT  /admin/seasons/{season_id}/saga/{champion_id}` body `{is_saga_attacker,
    is_saga_defender}` → upsert.
- Remove the two `toggle_saga_attacker` / `toggle_saga_defender` endpoints + service methods
  (they were global).
- `dto_admin/dto_champion`: drop `is_saga_attacker` / `is_saga_defender` from create/update
  and response DTOs.

## Read consumers (DTO builders)

`dto_champion_user`, `dto_alliance_roster`, `dto_defense` currently read
`champion.is_saga_*`. Change them to accept an injected `saga_roles: dict[UUID, tuple]`
and read `(att, def) = saga_roles.get(champion_id, (False, False))`. **Output shape is
unchanged** — they still expose `is_saga_attacker` / `is_saga_defender`, so all frontend
read consumers (roster card, defense/war selectors) need no change.

## WarFightRecord snapshot

`WarFightRecord.is_saga_attacker` / `defender_is_saga_defender` are **historical snapshots**
frozen at fight-record creation. Keep the columns. At creation
(`dev_controller.py:470` and any other fight-record write path), source the snapshot from
`SagaService.resolve_current()` instead of `champion.is_saga_*`. Existing records keep their
frozen values untouched.

## Frontend

- **Extract the season selector**: knowledge-base filters
  (`knowledge-base-filters.tsx`, via `onSeasonSelectorChange` / `onSeasonIdChange`) already
  use a season selector. Extract it into a **shared component** (e.g.
  `front/app/components/season-select.tsx`) and reuse it in both knowledge-base and the
  admin champions toolbar. Defaults to the current season.
- **Admin champions page**: add the shared season `Select` to the toolbar. `champion-table-row`
  saga toggle buttons now call the season-scoped endpoint (`onToggleSagaAttacker` /
  `onToggleSagaDefender` pass the selected `season_id`). Toggle state comes from
  `GET /admin/seasons/{season_id}/saga`, not from `champion.is_saga_*`.
- `services/champions.ts`: add the two season-scoped saga endpoints; drop the old global
  toggle calls. Drop `is_saga_attacker` / `is_saga_defender` from the admin `Champion` type.
- Read consumers unchanged (DTO prop shape preserved).
- i18n: add season-selector + saga labels to `en.ts` & `fr.ts`.

## Edge cases (accepted defaults)

1. No current season → all champions show as neither attacker nor defender.
2. Champion deleted → cascade-delete its `champion_saga_role` rows.
3. Season dropdown defaults to the current season; admin may edit any season, including
   `ended` ones.

## Migration (`/db-migrate` skill)

1. Create table `champion_saga_role`.
2. Drop columns `is_saga_attacker`, `is_saga_defender` from `champion`.

No backfill.

## Testing

- **Backend unit**: `SagaService.resolve_current` (upcoming beats active; no season → `{}`),
  `upsert_role` insert vs update.
- **Backend integration**: admin sets saga per season via `PUT`; roster/defense DTO reflects
  the current season's roles; `GET` returns them.
- **E2E**: admin sets saga for a season → roster shows the flag; a new season's pre-season
  flips the classification.

## Out of scope

- No history/audit of saga changes beyond the per-season rows themselves.
- No change to war-season lifecycle (`open/close/revert`) semantics.
