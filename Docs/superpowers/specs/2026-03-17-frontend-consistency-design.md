# Frontend Consistency & Component Splitting

**Date:** 2026-03-17
**Approach:** Structure first, then shared hooks, then component splitting (Approach A)

---

## Context

The frontend has grown unevenly across feature pages. Some pages follow a clean shell + `_components/` pattern (`war/`, `defense/`), while others (`alliances/`, `roster/`) keep everything in `page.tsx`. Several large files exceed 400 lines and mix data fetching, business logic, and rendering. The same alliance/BG selection boilerplate is duplicated across three pages.

---

## Phase 1 — Homogenize Structure

**Convention target** (already applied in `war/` and `defense/`):

```
app/game/<feature>/
  page.tsx                      ← thin shell: Suspense + session wrapper only (~15 lines)
  _components/
    <feature>-content.tsx       ← logic + state + main render
    <sub-components>.tsx
```

**Changes:**

| File | Action |
|------|--------|
| `alliances/page.tsx` (494L) | Becomes a thin shell; content moves to `_components/alliance-content.tsx` |
| `roster/page.tsx` (434L) | Becomes a thin shell; content moves to `_components/roster-content.tsx` |
| `war/page.tsx` | Already a shell — no change needed |
| `defense/` | Already follows convention — no change needed |

Existing `_components/` sub-components in both pages are untouched.

**Success criteria:** Every `game/` page follows the exact same file structure. A developer opening any page immediately finds the same pattern.

---

## Phase 2 — Shared Hooks

### `hooks/use-alliance-selector.ts` (new)

Centralizes the pattern repeated across war, defense, and alliances:

- Fetches `getMyAlliances` on mount
- Manages `selectedAllianceId` + `selectedBg` state
- Syncs with URL params (`?alliance=&bg=`)
- Returns `{ alliances, selectedAllianceId, setSelectedAllianceId, selectedBg, setSelectedBg, loading }`

Each of the three consuming pages loses ~40–60 lines of identical boilerplate.

### `app/game/war/_hooks/use-war-actions.ts` (new)

Extracts all war business logic from `war-content.tsx`:

- `handlePlaceDefender`, `handleRemoveDefender`, `handleClearBg`
- `handleAssignAttacker`, `handleRemoveAttacker`
- `handleCreateWar`, `handleEndWar`, `handleToggleKo`
- Derived state: `activeWarId`, `warSummary`, `wars`

`war-content.tsx` retains only rendering and UI selectors.

### `app/game/defense/_hooks/use-defense-actions.ts` (new)

Extracts all defense business logic from `defense-content.tsx`:

- `handlePlaceDefender`, `handleRemoveDefender`, `handleClearDefense`
- `handleExport`, `handleImport`
- Polling logic (`resetPollTimer`)
- State: `defense`, `availableChampions`, `bgMembers`

**Success criteria:** No `getMyAlliances` call outside of `useAllianceSelector`. No handler function defined directly in a content component.

---

## Phase 3 — Component Splitting

### `war-content.tsx` (662L → target ~150L)

After `useWarActions` extraction, split remaining JSX:

| New component | Responsibility |
|---------------|---------------|
| `WarHeader` | Alliance + BG + war selectors, create/end buttons |
| `WarDefenseTab` | Defense tab: `WarDefenseMap` + `WarChampionSelector` |
| `WarAttackerTab` | Attacker tab: `WarAttackerPanel` + `WarAttackerSelector` |

`war-content.tsx` becomes a coordinator: `useWarActions` + tab switcher + the 3 sub-components.

### `defense-content.tsx` (466L → target ~120L)

After `useDefenseActions` extraction, split:

| New component | Responsibility |
|---------------|---------------|
| `DefenseHeader` | Alliance + BG selectors, export/import/clear buttons |
| `DefenseGrid` | Defense map + `ChampionSelector` |

### `alliance-content.tsx` (after Phase 1)

After the page→content move, extract inline JSX blocks:

| New component | Responsibility |
|---------------|---------------|
| `InvitationsSection` | Received invitations list (~60L currently inline) |
| `AlliancesTab` | Alliance list + empty state (currently inline) |

### `roster-import-export.tsx` (446L)

Shared component — no structural split needed, but extract a local hook `useRosterImportExport` to separate logic from rendering.

**Success criteria:** No file in `_components/` exceeds 150 lines. Every component has a single clear responsibility.

---

## File Inventory

**New files:**
- `front/hooks/use-alliance-selector.ts`
- `front/app/game/war/_hooks/use-war-actions.ts`
- `front/app/game/defense/_hooks/use-defense-actions.ts`
- `front/app/game/alliances/_components/alliance-content.tsx`
- `front/app/game/alliances/_components/invitations-section.tsx`
- `front/app/game/alliances/_components/alliances-tab.tsx`
- `front/app/game/roster/_components/roster-content.tsx`
- `front/app/game/war/_components/war-header.tsx`
- `front/app/game/war/_components/war-defense-tab.tsx`
- `front/app/game/war/_components/war-attacker-tab.tsx`
- `front/app/game/defense/_components/defense-header.tsx`
- `front/app/game/defense/_components/defense-grid.tsx`

**Modified files:**
- `front/app/game/alliances/page.tsx` (thinned to shell)
- `front/app/game/roster/page.tsx` (thinned to shell)
- `front/app/game/war/_components/war-content.tsx` (reduced to coordinator)
- `front/app/game/defense/_components/defense-content.tsx` (reduced to coordinator)
- `front/components/roster-import-export.tsx` (logic extracted to hook)

---

## Constraints

None specified — full refactoring freedom.

## Non-goals

- No changes to `app/services/`
- No changes to `components/ui/` (shadcn primitives)
- No API or backend changes
- No new features
