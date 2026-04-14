# MVVM Architecture — Frontend Mawster

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** Frontend Next.js App Router (`front/app/`)

---

## Problem

The current `*-content.tsx` components are god components that mix data fetching, state management, business logic, derived data, and JSX rendering in a single file (e.g. `roster-content.tsx` = 435 lines). This makes them hard to test, reason about, and maintain.

---

## Solution: MVVM with custom hooks as ViewModels

### The 3 Layers

| Layer | Responsibility | Files |
|---|---|---|
| **Model** | API calls + types | `services/*.ts` — unchanged |
| **ViewModel** | State, effects, actions, derived data | `_viewmodels/use-<feature>-viewmodel.ts` |
| **View** | Rendering only | `_components/*-content.tsx` + sub-components |

### File Structure Convention

Each feature page gets a `_viewmodels/` folder at the same level as `_components/`:

```
game/roster/
  page.tsx                              ← thin shell (unchanged)
  _components/
    roster-content.tsx                  ← View: calls hook, renders only
    roster-grid.tsx                     ← pure sub-component
    ...
  _viewmodels/
    use-roster-viewmodel.ts             ← ViewModel: all state + logic
```

---

## ViewModel Contract

### Shape

```ts
export function useRosterViewModel() {
  // All useState, useEffect, useCallback, useMemo, service calls
  // All business logic and derived data

  return {
    // State (readonly)
    roster: RosterEntry[];
    accounts: GameAccount[];
    selectedAccountId: string | null;
    loadingRoster: boolean;
    loadingAccounts: boolean;
    error: string | null;
    activeTab: RosterTab;
    groupedRoster: [string, RosterEntry[]][];
    showAddForm: boolean;
    editEntry: RosterEntry | null;
    deleteTarget: RosterEntry | null;
    upgradeTarget: RosterEntry | null;
    ascendTarget: RosterEntry | null;
    upgradeRefreshKey: number;

    // Actions
    setSelectedAccountId: (id: string | null) => void;
    setActiveTab: (tab: RosterTab) => void;
    setDeleteTarget: (entry: RosterEntry | null) => void;
    setUpgradeTarget: (entry: RosterEntry | null) => void;
    setAscendTarget: (entry: RosterEntry | null) => void;
    setShowAddForm: (open: boolean) => void;
    startEditEntry: (entry: RosterEntry) => void;
    confirmDelete: () => Promise<void>;
    confirmUpgrade: () => Promise<void>;
    confirmAscend: () => Promise<void>;
    handleFormSuccess: (updated: RosterEntry[]) => void;
    handleTogglePreferredAttacker: (entry: RosterEntry) => Promise<void>;
    clearError: () => void;
  };
}
```

### Rules

- The ViewModel is the **only** place that imports and calls services.
- The View **never** imports from `services/` directly.
- Toasts (`toast.success/error`) live in the ViewModel, not the View.
- Derived data (e.g. `groupedRoster`) is computed with `useMemo` in the ViewModel.
- No JSX is returned from the ViewModel.

---

## View Contract

### Shape

```tsx
export default function RosterContent() {
  const vm = useRosterViewModel();
  // Pure rendering — ≤150 lines
  return (...);
}
```

### Rules

- Destructure from `vm` at the top, or pass `vm` to sub-components.
- Sub-components receive only what they need via props.
- No `useState`, `useEffect`, or service calls in the View.

---

## Data Flow

```
Service (fetch) → ViewModel (state + actions) → View (render)
                        ↑
               actions returned by hook, called from event handlers in View
```

---

## Error Handling

- ViewModel exposes `error: string | null` and `clearError: () => void`.
- Async errors shown immediately via `toast.error()` in the ViewModel.
- Persistent errors displayed via `<ErrorBanner message={vm.error} onDismiss={vm.clearError} />` in the View.

---

## Migration Scope

5 content components to migrate:

| Feature | Content Component | ViewModel to Create |
|---|---|---|
| Roster | `game/roster/_components/roster-content.tsx` | `game/roster/_viewmodels/use-roster-viewmodel.ts` |
| Defense | `game/defense/_components/defense-content.tsx` | `game/defense/_viewmodels/use-defense-viewmodel.ts` |
| War | `game/war/_components/war-content.tsx` | `game/war/_viewmodels/use-war-viewmodel.ts` |
| Alliances | `game/alliances/_components/alliance-content.tsx` | `game/alliances/_viewmodels/use-alliances-viewmodel.ts` |
| Admin | `admin/_components/admin-content.tsx` | `admin/_viewmodels/use-admin-viewmodel.ts` |

`profile/` — no heavy content component, no ViewModel needed.

---

## What Does NOT Change

- `services/*.ts` — unchanged
- `page.tsx` shells — unchanged
- `components/ui/` (shadcn) — never modified
- `data-cy` attributes, i18n keys, Tailwind tokens — unchanged
- E2E Cypress tests — unchanged (they test behavior, not structure)

---

## Testing

- **ViewModel**: testable in isolation with `renderHook` (React Testing Library) — no component mount, no network
- **View**: testable with mocked props — no service calls
- **E2E**: unchanged (Cypress covers behavior end-to-end)

---

## Multi-Session TODO

Track progress here as features are migrated. Check off each item when both the ViewModel and the updated View are committed.

### Phase 1 — ViewModel extraction

- [ ] `roster` — extract `use-roster-viewmodel.ts`, update `roster-content.tsx`
- [ ] `defense` — extract `use-defense-viewmodel.ts`, update `defense-content.tsx`
- [ ] `war` — extract `use-war-viewmodel.ts`, update `war-content.tsx`
- [ ] `alliances` — extract `use-alliances-viewmodel.ts`, update `alliance-content.tsx`
- [ ] `admin` — extract `use-admin-viewmodel.ts`, update `admin-content.tsx`

### Phase 2 — Verification

- [ ] `npm run build` passes (no TS errors)
- [ ] `test-backend` passes (no regression)
- [ ] E2E smoke run on migrated pages passes

### Definition of Done (per feature)

1. `_viewmodels/use-<feature>-viewmodel.ts` created — all state, effects, actions, derived data
2. `*-content.tsx` updated — calls hook, renders only, ≤150 lines
3. No service import remains in the View
4. `npm run build` passes
