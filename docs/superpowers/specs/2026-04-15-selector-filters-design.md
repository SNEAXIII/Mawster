# Selector Filters & Rename — Design Spec
Date: 2026-04-15

## Summary

Add client-side filter bars (class, player, saga, preferred) + reset to the two champion selector dialogs. Rename `ChampionSelector` → `AllianceDefenseSelector` for naming consistency. Extract shared filter bar UI into a `SelectorFilterBar` component to avoid duplication.

---

## Scope

### 1. Rename: ChampionSelector → AllianceDefenseSelector

- File: `front/app/game/defense/_components/champion-selector.tsx` → `alliance-defense-selector.tsx`
- Export default: `ChampionSelector` → `AllianceDefenseSelector`
- Update import in `front/app/game/defense/_components/defense-grid.tsx`

### 2. Shared component: `SelectorFilterBar`

Location: `front/app/game/_components/selector-filter-bar.tsx`

Renders: class dropdown + configurable toggle buttons + reset button. Stateless — all state lives in the parent.

```tsx
interface ToggleConfig {
  key: string;
  label: string;
  active: boolean;
  onToggle: (v: boolean) => void;
}

interface SelectorFilterBarProps {
  classes: string[];           // unique class values for dropdown
  classFilter: string;
  onClassChange: (v: string) => void;
  players?: string[];          // optional — only for defense selector
  playerFilter?: string;
  onPlayerChange?: (v: string) => void;
  toggles: ToggleConfig[];
  canReset: boolean;
  onReset: () => void;
}
```

- Class dropdown: shadcn `Select`, placeholder from `t.roster.selectClass`
- Toggle buttons: shadcn `Button` variant `outline`, active state = `bg-primary/10 border-primary text-primary`
- Reset button: shadcn `Button` variant `ghost` size `sm`, shown only when `canReset`, label `t.dashboard.resetFilters`

### 3. AllianceDefenseSelector — filter state & logic

**New state:**
| State | Type | Default |
|---|---|---|
| `classFilter` | `string` | `''` |
| `playerFilter` | `string` | `''` |
| `sagaFilter` | `boolean` | `false` |
| `notPreferredFilter` | `boolean` | `false` |

**Derived (useMemo):**
- `availableClasses` — unique sorted `champion_class` from `availableChampions`
- `availablePlayers` — unique sorted `game_pseudo` from all `availableChampions[].owners[]`
- `canReset` — `search !== '' || classFilter !== '' || playerFilter !== '' || sagaFilter || notPreferredFilter`

**Filtering logic:**
```ts
const filtered = useMemo(() => {
  return availableChampions.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search.trim() ||
      c.champion_name.toLowerCase().includes(q) ||
      c.champion_class.toLowerCase().includes(q) ||
      (c.champion_alias ?? '').toLowerCase().includes(q);
    const matchClass = !classFilter || c.champion_class === classFilter;
    const matchPlayer = !playerFilter || c.owners.some(o => o.game_pseudo === playerFilter);
    const matchSaga = !sagaFilter || c.is_saga_defender;
    const matchNotPreferred = !notPreferredFilter || c.owners.every(o => !o.is_preferred_attacker);
    return matchSearch && matchClass && matchPlayer && matchSaga && matchNotPreferred;
  });
}, [search, classFilter, playerFilter, sagaFilter, notPreferredFilter, availableChampions]);
```

**Reset:** clears all filter state including `search`.

**Filter bar usage:**
```tsx
<SelectorFilterBar
  classes={availableClasses}
  classFilter={classFilter}
  onClassChange={setClassFilter}
  players={availablePlayers}
  playerFilter={playerFilter}
  onPlayerChange={setPlayerFilter}
  toggles={[
    { key: 'saga', label: t.game.defense.sagaDefenderFilter, active: sagaFilter, onToggle: setSagaFilter },
    { key: 'notPreferred', label: t.game.defense.notPreferredFilter, active: notPreferredFilter, onToggle: setNotPreferredFilter },
  ]}
  canReset={canReset}
  onReset={reset}
/>
```

### 4. WarAttackerSelector — filter state & logic

**New state:**
| State | Type | Default |
|---|---|---|
| `classFilter` | `string` | `''` |
| `sagaFilter` | `boolean` | `false` |
| `preferredFilter` | `boolean` | `false` |

**Derived (useMemo):**
- `availableClasses` — unique sorted `champion_class` from `available`
- `canReset` — `playerSearch !== '' || championSearch !== '' || classFilter !== '' || sagaFilter || preferredFilter`

**Filtering logic (extends existing):**
```ts
const filtered = available.filter((a) => {
  const matchPlayer = !playerSearch || a.game_pseudo.toLowerCase().includes(playerSearch.toLowerCase());
  const alias = (a.champion_alias ?? '').toLowerCase();
  const matchChampion = !championSearch ||
    a.champion_name.toLowerCase().includes(championSearch.toLowerCase()) ||
    alias.includes(championSearch.toLowerCase());
  const matchClass = !classFilter || a.champion_class === classFilter;
  const matchSaga = !sagaFilter || a.is_saga_attacker;
  const matchPreferred = !preferredFilter || a.is_preferred_attacker;
  return matchPlayer && matchChampion && matchClass && matchSaga && matchPreferred;
});
```

**Reset:** clears `playerSearch`, `championSearch`, `classFilter`, `sagaFilter`, `preferredFilter`.

**Filter bar usage:**
```tsx
<SelectorFilterBar
  classes={availableClasses}
  classFilter={classFilter}
  onClassChange={setClassFilter}
  toggles={[
    { key: 'saga', label: t.game.war.sagaAttackerFilter, active: sagaFilter, onToggle: setSagaFilter },
    { key: 'preferred', label: t.game.war.preferredAttackerFilter, active: preferredFilter, onToggle: setPreferredFilter },
  ]}
  canReset={canReset}
  onReset={reset}
/>
```

---

## i18n Keys

### New keys — `en.ts` / `fr.ts`

Under `game.defense`:
```ts
sagaDefenderFilter: 'Saga Defender',   // fr: 'Saga Défenseur'
notPreferredFilter: 'Not Preferred',   // fr: 'Non Préféré'
playerFilter: 'Player',                // fr: 'Joueur'
```

Under `game.war`:
```ts
sagaAttackerFilter: 'Saga Attacker',      // fr: 'Saga Attaquant'
preferredAttackerFilter: 'Preferred',     // fr: 'Préféré'
```

### Reused existing keys
- `t.roster.classFilter` — class dropdown label
- `t.roster.selectClass` — class dropdown placeholder
- `t.dashboard.resetFilters` — reset button label

---

## Files Modified

| File | Change |
|---|---|
| `front/app/game/defense/_components/champion-selector.tsx` | Deleted (replaced) |
| `front/app/game/defense/_components/alliance-defense-selector.tsx` | New — renamed + filter state + logic |
| `front/app/game/defense/_components/defense-grid.tsx` | Update import |
| `front/app/game/war/_components/war-attacker-selector.tsx` | Add filter state + logic + SelectorFilterBar |
| `front/app/game/_components/selector-filter-bar.tsx` | New — shared filter bar UI |
| `front/app/i18n/locales/en.ts` | Add new i18n keys |
| `front/app/i18n/locales/fr.ts` | Add new i18n keys |

---

## Out of Scope

- Server-side pagination / API changes
- Page navigation controls (per-page, prev/next)
- Modifying `PaginationControls` component
