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
- `test_get_current_war_requires_alliance_member` — 403 for authenticated user who is not a member of the alliance

---

## Frontend

### New Hook: `useCurrentWar(allianceId)`

Location: `front/app/game/defense/_hooks/use-current-war.ts`

Responsibilities:
- Fetch `GET /alliances/{allianceId}/wars/current` when `allianceId` changes
- Expose: `currentWar: War | null`, `warLoading: boolean`, `handleCreateWar(opponentName)`, `handleEndWar()`
- `handleCreateWar` calls `POST /alliances/{id}/wars`, then refreshes `currentWar`
- `handleEndWar` calls `POST /alliances/{id}/wars/{war_id}/end`, then sets `currentWar = null`
- State: `showCreateDialog`, `setShowCreateDialog`, `showEndConfirm`, `setShowEndConfirm`

This hook is used in **both** pages:
- Defense page: drives `WarBanner` + dialogs
- War page (`war-content.tsx`): replaces the current `getWars` call to derive `activeWarId`

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

`CreateWarDialog` lives at `front/app/game/war/_components/create-war-dialog.tsx`. Import it directly cross-feature (no move needed — it is a pure dialog component with no war-page-specific dependencies).

### Changes to `DefenseContent`

- Import and call `useCurrentWar(selectedAllianceId)`
- Render `<WarBanner ...>` between header and grid (officers only)
- Render `<CreateWarDialog>` and end-war `<ConfirmationDialog>`

### Files to Delete

- `front/app/game/war/_components/war-management-tab.tsx` — entire file

### Files to Edit

- `front/app/game/war/_components/war-types.ts` — remove `WarTab.Management` enum value; leave `WarMode` unchanged
- `front/app/game/war/_hooks/use-war-actions.ts` — edit (keep file): remove `wars`, `selectedWarId`, `setSelectedWarId`, `showCreateDialog`, `setShowCreateDialog`, `showEndWarConfirm`, `setShowEndWarConfirm`, `handleCreateWar`, `handleEndWar`, and `fetchWars`. Change signature from `(allianceId, bg)` → `(allianceId, bg, activeWarId: string)` so the hook no longer derives `activeWarId` from a wars list. All remaining actions (`handlePlaceDefender`, `handleRemoveDefender`, `handleClearBg`, `handleAssignAttacker`, `handleRemoveAttacker`, `handleUpdateKo`, polling) use the passed-in `activeWarId`. The caller (`war-content.tsx`) passes `currentWar?.id ?? ''` — all actions guard with `if (!activeWarId) return` so the null/empty case is safe.
- `front/app/game/war/_components/war-content.tsx` — use `useCurrentWar` to get `activeWarId`; remove Management tab rendering, the `WarTab.Management` tab entry, and all management-related state/imports; pass `activeWarId` to `useWarActions`

### E2E Files to Delete

- `front/cypress/e2e/war/management.cy.ts` — entire file, covers only management tab

### E2E Tests to Add

`front/cypress/e2e/defense/war-controls.cy.ts` — use `setupDefenseOwner` (includes BG1 needed for defense page):
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
