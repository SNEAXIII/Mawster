# War Fight Record — Design Spec

**Date:** 2026-05-02  
**Branch:** feat/war-fight-record  
**Scope:** Backend only. Frontend knowledge base rendering is out of scope.

---

## Problem

`WarDefensePlacement.attacker_champion_user_id` is a live FK to `ChampionUser`. If a player upgrades their champion after a fight (e.g. 7r4 → 7r5), the historical fight data reflects the new rank — not the rank at fight time. Synergies and prefight champions have the same issue.

---

## Solution

Snapshot all fight data into immutable records when `end_war` is called. Planning tables (`WarDefensePlacement`, `WarSynergyAttacker`, `WarPrefightAttacker`) remain unchanged during the war and are read once at close time to produce the snapshot.

---

## Data Model

### `WarFightRecord` (new table)

One row per completed node per war. Created at war close.

| field | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `war_id` | UUID FK → war | |
| `alliance_id` | UUID FK → alliance | denormalized for query speed |
| `season_id` | UUID FK → season, nullable | from `War.season_id` |
| `game_account_id` | UUID FK → game_account | who fought |
| `battlegroup` | int 1–3 | |
| `node_number` | int 1–50 | |
| `tier` | int | from `War.tier` at close time |
| `champion_id` | UUID FK → champion | attacker, snapshot |
| `stars` | int | attacker snapshot |
| `rank` | int | attacker snapshot |
| `ascension` | int | attacker snapshot |
| `is_saga_attacker` | bool | snapshot from `Champion.is_saga_attacker` |
| `defender_champion_id` | UUID FK → champion | defender snapshot |
| `defender_stars` | int | defender snapshot |
| `defender_rank` | int | defender snapshot |
| `defender_ascension` | int | defender snapshot |
| `defender_is_saga_defender` | bool | snapshot from `Champion.is_saga_defender` |
| `ko_count` | int | from `WarDefensePlacement.ko_count` |
| `created_at` | datetime | |

### `WarFightSynergy` (new table)

One row per synergy champion per fight. No rank stored.

| field | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `war_fight_record_id` | UUID FK → war_fight_record | |
| `champion_id` | UUID FK → champion | |
| `stars` | int | |
| `ascension` | int | |

### `WarFightPrefight` (new table)

One row per prefight champion per fight. Supports multiple prefights per node. No rank stored.

| field | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `war_fight_record_id` | UUID FK → war_fight_record | |
| `champion_id` | UUID FK → champion | |
| `stars` | int | |
| `ascension` | int | |

### `WarSynergyAttacker` — unchanged

Stays BG-wide (no `node_number`). At snapshot time, synergies for a fight are resolved by matching `target_champion_user_id = attacker_champion_user_id` from `WarDefensePlacement`.

---

## Snapshot Logic (end_war)

Triggered inside `WarService.end_war` after `War.status = ended`.

For each `WarDefensePlacement` where `attacker_champion_user_id` is set.

Steps:
1. Load `ChampionUser` via `attacker_champion_user_id` → get `champion_id`, `stars`, `rank`, `ascension`
2. Load `Champion` → get `is_saga_attacker`
3. Read defender from `WarDefensePlacement` (`champion_id`, `stars`, `rank`, `ascension`) + load `Champion.is_saga_defender`
4. Load `WarPrefightAttacker` rows for `(war_id, battlegroup, target_node_number)` → for each: load `ChampionUser` → `champion_id`, `stars`, `ascension` → create `WarFightPrefight`
5. Load `WarSynergyAttacker` rows for `(war_id, battlegroup)` where `target_champion_user_id = attacker_champion_user_id` → for each: load `ChampionUser` → `champion_id`, `stars`, `ascension` → create `WarFightSynergy`
6. Create `WarFightRecord` with `tier` and `alliance_id` and `season_id` from `War`

---

## API

### New endpoint

```
GET /fight-records
```

- **Auth:** `AuthService.get_current_user_in_jwt` + user must belong to at least one alliance
- **Scope:** global — returns records across all alliances
- **Query params (all optional):** `champion_id`, `defender_champion_id`, `node_number`, `tier`, `season_id`, `alliance_id`, `battlegroup`
- **Response:** `list[WarFightRecordResponse]` — includes attacker, defender, synergies, prefights, ko_count, tier, season, alliance

### Unchanged endpoints

All existing war endpoints remain unchanged. `end_war` gains snapshot logic as a side effect.

---

## Out of Scope

- Frontend page to browse the knowledge base (later)
- Multiple attackers per node (future)
- Filtering by `is_combat_completed` (visual flag only)

---

## Migrations

Single Alembic migration for all 3 new tables:

```bash
make reset-db
make create-mig MESSAGE="add_war_fight_record"
make migrate
```
