# War Declaration — Page Guerre

**Date:** 2026-03-22
**Status:** Approved

## Context

The war declaration feature was previously mixed into the defense page hooks (`use-current-war.ts`). The goal is to move it cleanly into the war page, keeping the defense page untouched.

## Design

### Layout

```
[ Alliance select ]                          ← header, only if multi-alliance
─────────────────────────────────────────────
  No war declared.  [ Declare War ]          ← canManage, no active war
  — or —
  ⚔ vs Enemy Alliance  [ End War ]          ← canManage, active war
─────────────────────────────────────────────
  G1  G2  G3  |  Defenders / Attackers      ← mode toggle: canManage only
  [ 50-node war map ]                        ← visible to all when war active
  — or —
  No active war in progress.                 ← when no active war
```

### Role Rules

- **canManage (officer + owner):** sees the management bar (declare / end war) and the mode toggle
- **All members:** see the war map for the active war
- No tabs, no war selector dropdown

## Components

### `war-content.tsx` — main page component

**Migration note:** the current file imports `useCurrentWar` from `defense/_hooks/` — this import must be removed and replaced with the inlined logic below. The defense page continues to use `use-current-war.ts` unchanged.

Owns all state. Does **not** use `useCurrentWar` from `defense/_hooks/`. Instead, inlines war fetch/create/end logic directly:

**State:**
- `currentWar: War | null` — fetched via `getCurrentWar(allianceId)`, 404 → null
- `managementLoading: boolean` — loading state for the war fetch (distinct from `warLoading` from `useWarActions` which covers placements)
- `showCreateDialog: boolean`
- `showEndConfirm: boolean`
- Existing: `selectedBg`, `warMode`, `selectorNode`, `attackerSelectorNode`, `showClearConfirm`

**Actions:**
- `handleCreateWar(opponentName: string)` — calls `createWar()`, toasts success, sets `currentWar`
- `handleEndWar()` — called from `ConfirmationDialog` confirm; calls `endWar()`, toasts success, sets `currentWar = null`

**Loading state in management bar:** while `managementLoading` is true, render a skeleton or spinner in place of the management bar (do not render the declare/end buttons yet).

**Backend contract:** `GET /alliances/{id}/wars/current` filters `status == "active"` — it returns 404 for ended wars. So `currentWar` is always either an active `War` or `null`. No `status` check needed:
```ts
const activeWarId = currentWar?.id ?? '';
```

**`create-war-dialog.tsx`** is rendered in `war-content.tsx` (not inside `war-management-bar.tsx`), controlled by `showCreateDialog` state.

### `war-management-bar.tsx` *(new)*

Props:
```ts
interface WarManagementBarProps {
  activeWar: War | null;
  loading: boolean;
  onClickDeclare: () => void;   // opens the dialog — does NOT call createWar directly
  onClickEndWar: () => void;    // sets showEndConfirm = true — does NOT call endWar directly
}
```

- `loading` → render spinner
- `activeWar === null` → "No war declared." text + button `data-cy='declare-war-btn'`
- `activeWar !== null` → `data-cy='war-opponent-name'` span with "⚔ vs [name]" + button `data-cy='end-war-btn'`

### `create-war-dialog.tsx` *(existing)* — unchanged

Calls `onConfirm(opponentName)` which maps to `handleCreateWar` in `war-content.tsx`.

### `war-defenders-tab.tsx` *(existing)* — unchanged

Mode toggle already gated by `canManageWar`. Its prop type is `activeWar: War | undefined`. Since `war-content.tsx` holds `currentWar: War | null`, pass it as `activeWar={currentWar ?? undefined}` — no changes to the tab component needed.

## What Does NOT Change

- `front/app/game/defense/` — entirely untouched
- `defense/_hooks/use-current-war.ts` — stays where it is, used only by defense
- `war-defenders-tab.tsx`, `create-war-dialog.tsx` — unchanged
- Backend API — no changes

## Cypress Test Changes

### Files to update

**`basic.cy.ts`:**

| Old test | New test |
|---|---|
| `shows management tab for officer/owner` | `shows declare war button for officer/owner` — `cy.getByCy('declare-war-btn').should('be.visible')` |
| `shows only defenders tab for non-officer members` | `shows no declare war button for non-officer members` — `cy.getByCy('declare-war-btn').should('not.exist')` |
| `shows war in selector after creation` | `shows war opponent after creation` — after `cy.apiCreateWar(...)` + login: `cy.getByCy('war-opponent-name').should('contain', 'Enemy Alliance')` |
| `shows 50 war-map nodes after selecting a war and going to defenders tab` | Remove `cy.getByCy('tab-war-defenders').click()` — nodes are visible directly |
| `shows G1/G2/G3 battlegroup buttons in defenders tab` | Remove `cy.getByCy('tab-war-defenders').click()` |
| `shows declare war button in management tab for officer` | Remove tab navigation — `cy.getByCy('declare-war-btn').should('be.visible')` directly |

- Remove `cy.getByCy('tab-war-defenders').click()` from all 6 mode-toggle tests: `shows mode toggle`, `defaults to defenders mode`, `switches to attackers mode on click`, `mode toggle is hidden for non-officer members`, `switches back to defenders mode from attackers`, and any other mode-toggle test that clicks the tab before asserting

**`operations.cy.ts`:**
- Remove all `cy.getByCy('tab-war-defenders').click()` — affects 5 tests (place, placed-hidden, remove, clear, bg-switch, declare)
- `officer can declare a war via the dialog` — replace `cy.getByCy('war-select').should('contain', 'MightyFoes')` with `cy.getByCy('war-opponent-name').should('contain', 'MightyFoes')`

**`war-attackers.cy.ts`:**
- Remove all `cy.getByCy('tab-war-defenders').click()` — affects all 6 tests in the file

**`war-status.cy.ts`:**
- Remove `cy.getByCy('tab-war-defenders').click()`
- Since `getCurrentWar` returns 404 for ended wars, after `apiEndWar` the page shows `currentWar = null`
- Change `cy.contains('No active war')` → `cy.contains('No war declared')` (i18n key `noWar`)
- Rename test: `"shows no-war message after war ends"`
- `cy.getByCy('war-node-1').should('not.exist')` assertion stays valid

**`attackers.cy.ts`** *(stubbed skip file)*:
- Update the implementation instructions comment: remove references to "switch to Defenders tab if needed"

### New tests to add (in `basic.cy.ts` or new `war-management.cy.ts`)

- `officer can end a war via the end war button` — creates war via API, logs in as owner, clicks `end-war-btn`, confirms dialog, checks `declare-war-btn` is visible again and `war-node-1` does not exist
