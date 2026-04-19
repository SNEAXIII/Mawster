# Masteries per Game Account — Design Spec

**Date:** 2026-04-19  
**Status:** Approved

---

## Overview

Each game account can define a set of masteries. For each mastery the account owner sets how many points are **unlocked**, how many are allocated to the **attack** preset, and how many to the **defense** preset. Masteries are visible to all alliance members in the roster section.

---

## Data Model

### `Mastery` (admin-managed)

| Field       | Type      | Notes                              |
|-------------|-----------|-------------------------------------|
| id          | UUID PK   |                                     |
| name        | str       | e.g. "ASSASSIN", "RECOIL"           |
| max_value   | int       | Immutable after creation            |
| order       | int       | Display ordering                    |

Initial seed list:

| Name               | max_value |
|--------------------|-----------|
| ASSASSIN           | 6         |
| RECOIL             | 3         |
| LIQUID COURAGE     | 3         |
| DOUBLE EDGE        | 3         |
| STAND YOUR GROUND  | 5         |
| COLLAR TECH        | 5         |
| LIMBER             | 3         |
| MYSTIC DISPERSION  | 5         |

### `GameAccountMastery` (per account)

| Field            | Type    | Notes                                        |
|------------------|---------|----------------------------------------------|
| id               | UUID PK |                                              |
| game_account_id  | UUID FK | → game_account                               |
| mastery_id       | UUID FK | → mastery                                    |
| unlocked         | int     | 0 ≤ unlocked ≤ mastery.max_value             |
| attack           | int     | 0 ≤ attack ≤ unlocked                        |
| defense          | int     | 0 ≤ defense ≤ unlocked                       |

Unique constraint on `(game_account_id, mastery_id)`. Validation enforced server-side.

---

## API

### Admin endpoints (`/admin/masteries`)

| Method | Path                   | Description                          |
|--------|------------------------|--------------------------------------|
| GET    | /admin/masteries       | List all masteries (ordered)         |
| POST   | /admin/masteries       | Create — name + max_value + order    |
| PUT    | /admin/masteries/{id}  | Update name and/or order only        |
| DELETE | /admin/masteries/{id}  | Delete                               |

`max_value` cannot be changed after creation.

### Game account endpoints

| Method | Path                              | Auth                    |
|--------|-----------------------------------|-------------------------|
| GET    | /game-accounts/{id}/masteries     | Any alliance member     |
| PUT    | /game-accounts/{id}/masteries     | Account owner only      |

`PUT` is a **bulk upsert**: client sends the full mastery list. Triggered by the "Valider" button (no auto-save).

Request body:
```json
[
  { "mastery_id": "<uuid>", "unlocked": 4, "attack": 4, "defense": 2 },
  ...
]
```

Response: updated list of `GameAccountMasteryResponse`.

---

## Frontend

### Page restructure

Rename `front/app/game/roster/` → `front/app/game/account/`. Add three tabs using shadcn `Tabs`:

| Tab     | Content                                         |
|---------|-------------------------------------------------|
| Roster  | Existing champion roster (moved here)           |
| Mastery | New mastery management UI                       |
| Manage  | Existing game account management (was "accounts")|

### Mastery tab

- Fetch all masteries via `GET /game-accounts/{id}/masteries`
- Render a responsive grid of cards — one per mastery
- Each card: mastery name + max_value label, three number inputs (Unlocked / Attack / Defense)
- Inputs disabled if not account owner
- Single "Valider" button at bottom → `PUT /game-accounts/{id}/masteries`
- Use shadcn `Card`, `Input`, `Button` — dark-mode first, Tailwind semantic tokens

---

## Permissions

| Action              | Who              |
|---------------------|------------------|
| View masteries      | Any alliance member |
| Edit masteries      | Account owner only |
| Manage mastery list | Admin only       |

---

## Testing

**Backend:**
- Unit: DTO validation (unlocked ≤ max_value, attack ≤ unlocked, defense ≤ unlocked)
- Integration: GET (member can read), PUT (owner can write, non-owner 403), admin CRUD

**E2E (Cypress):**
- `data-cy` attributes on all mastery inputs and the Valider button
- Test: owner sets masteries → Valider → values persist
- Test: member can view but inputs are disabled
