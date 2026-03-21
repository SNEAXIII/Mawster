# Design: War Controls on Defense Page

**Date:** 2026-03-22
**Branch:** add-war-placement
**Status:** Approved

## Summary

Remove the war management tab entirely. Move "Declare War" and "End War" actions into the defense page via a new `WarBanner` component (officers/owner only). Add a new backend endpoint `GET /alliances/{id}/wars/current` to fetch the active war without fetching the full history.

## Motivation

The management tab was the only place to start or end a war, but it also showed a war history selector that is not yet needed. Users had to navigate to a separate tab just to declare or end a war. By moving these two actions to the defense page, the workflow becomes: open defense page → see active war status → act.

---

## Backend

### New Endpoint

```
GET /alliances/{alliance_id}/wars/current
```

- **Auth:** any alliance member
- **Returns:** `WarResponse` (200) if an active war exists, 404 otherwise
- **Logic:** query `War` table for `alliance_id` and `status == 'active'`, return first match or raise 404

### Existing Endpoints Used

- `POST /alliances/{id}/wars` — create war (officer/owner only, unchanged)
- `POST /alliances/{id}/wars/{war_id}/end` — end war (officer/owner only, unchanged)

### Tests to Add

`api/tests/integration/endpoints/war_test.py` — new test class `TestGetCurrentWar`:
- `test_get_current_war_returns_active_war` — 200 with active war data
- `test_get_current_war_returns_404_when_no_active_war` — 404 after war ended or none declared
- `test_get_current_war_requires_alliance_member` — 403 for non-member

---

## Frontend

### New Hook: `useCurrentWar(allianceId)`

Location: `front/app/game/defense/_hooks/use-current-war.ts`

Responsibilities:
- Fetch `GET /wars/current` when `allianceId` changes
- Expose: `currentWar: War | null`, `warLoading: boolean`, `handleCreateWar(opponentName)`, `handleEndWar()`
- `handleCreateWar` calls `POST /wars`, then refreshes `currentWar`
- `handleEndWar` calls `POST /wars/{id}/end`, then sets `currentWar = null`
- State: `showCreateDialog`, `setShowCreateDialog`, `showEndConfirm`, `setShowEndConfirm`

### New Component: `WarBanner`

Location: `front/app/game/defense/_components/war-banner.tsx`

Rendered in `DefenseContent` between `DefenseHeader` and `DefenseGrid`, visible only when `canManage === true`.

UI states:
1. **No active war** — "No active war" label + "Declare War" button (opens `CreateWarDialog`)
2. **Active war** — "vs {opponent}" chip + "End War" button (opens `ConfirmationDialog`)

Props:
```ts
interface WarBannerProps {
  currentWar: War | null;
  warLoading: boolean;
  onOpenCreateDialog: () => void;
  onOpenEndConfirm: () => void;
}
```

`data-cy` selectors needed:
- `war-banner` — the banner container
- `declare-war-btn` — declare war button
- `end-war-btn` — end war button
- `current-war-opponent` — opponent name display

Dialogs (`CreateWarDialog`, `ConfirmationDialog`) managed in `DefenseContent` via state from `useCurrentWar`.

### Changes to `DefenseContent`

- Import and call `useCurrentWar(selectedAllianceId)`
- Render `<WarBanner ...>` between header and grid (officers only)
- Render `<CreateWarDialog>` and end-war `<ConfirmationDialog>` (already exist in war page, reuse)

### Files to Delete

- `front/app/game/war/_components/war-management-tab.tsx`
- `front/app/game/war/_components/war-types.ts` — remove `WarTab.Management`; keep `WarMode`
- `front/app/game/war/_hooks/use-war-actions.ts` — remove: `wars`, `selectedWarId`, `setSelectedWarId`, `showCreateDialog`, `setShowCreateDialog`, `showEndWarConfirm`, `setShowEndWarConfirm`, `handleCreateWar`, `handleEndWar`
- `front/app/game/war/_components/war-content.tsx` — remove Management tab rendering, `TabBar` tab entry, management-related state and imports

### E2E Files to Delete

- `front/cypress/e2e/war/management.cy.ts` — entire file, covers only management tab

### E2E Tests to Add

`front/cypress/e2e/defense/war-controls.cy.ts`:
- Officer sees WarBanner with "Declare War" when no active war
- Officer can declare a war (opens dialog, submits, banner updates)
- Officer sees "End War" when active war exists
- Officer can end a war (confirm dialog, banner resets)
- Non-officer does not see WarBanner

---

## Data Flow

```
DefenseContent
  → useAllianceSelector        (allianceId)
  → useCurrentWar(allianceId)  (currentWar, handleCreateWar, handleEndWar, dialogs)
  → <DefenseHeader>            (unchanged)
  → <WarBanner>                (canManage only)
  → <DefenseGrid>              (unchanged)
  → <CreateWarDialog>
  → <ConfirmationDialog>       (end war)
```

---

## Out of Scope

- War history / past wars list (deferred)
- War page refactor beyond removing management tab
- War status page changes
