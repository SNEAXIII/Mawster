# Selector Filters & Rename — Design Spec
Date: 2026-04-15

## Summary

Add client-side filter bars (class, player, saga, preferred) + reset to the two champion selector dialogs. Rename `ChampionSelector` → `AllianceDefenseSelector` for naming consistency.

---

## Scope

### 1. Rename: ChampionSelector → AllianceDefenseSelector

- File: `front/app/game/defense/_components/champion-selector.tsx` → `alliance-defense-selector.tsx`
- Export default: `ChampionSelector` → `AllianceDefenseSelector`
- Update import in `front/app/game/defense/_components/defense-grid.tsx`

### 2. AllianceDefenseSelector — new filter bar

**New state:**
| State | Type | Default | Description |
|---|---|---|---|
| `classFilter` | `string` | `''` | Filter by `champion_class` |
| `playerFilter` | `string` | `''` | Filter by owner `game_pseudo` |
| `sagaFilter` | `boolean` | `false` | Show only `is_saga_defender === true` |
| `notPreferredFilter` | `boolean` | `false` | Show only champions where `owners.every(o => !o.is_preferred_attacker)` |

**Filter bar UI (rendered above the champion grid, replacing the lone SearchInput):**
```
[Search name/alias] [Player ▾] [Class ▾] [Saga Defender ○] [Not Preferred ○] [Reset ×]
```

**Filtering logic (extends existing `useMemo`):**
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

**Derived values:**
- `availableClasses` — `useMemo` over `availableChampions` → unique sorted `champion_class` values
- `availablePlayers` — `useMemo` over `availableChampions` → unique sorted `game_pseudo` from all owners
- `canReset` — `search !== '' || classFilter !== '' || playerFilter !== '' || sagaFilter || notPreferredFilter`

**Reset:** clears all filter state + `search`.

### 3. WarAttackerSelector — new filter bar

**New state:**
| State | Type | Default | Description |
|---|---|---|---|
| `classFilter` | `string` | `''` | Filter by `champion_class` |
| `sagaFilter` | `boolean` | `false` | Show only `is_saga_attacker === true` |
| `preferredFilter` | `boolean` | `false` | Show only `is_preferred_attacker === true` |

**Filter bar UI (added after the two existing search inputs):**
```
[Player search] [Champion search] [Class ▾] [Saga Attacker ○] [Preferred ○] [Reset ×]
```

**Filtering logic (extends existing `filtered`):**
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

**Derived values:**
- `availableClasses` — unique sorted `champion_class` from `available`
- `canReset` — `playerSearch || championSearch || classFilter || sagaFilter || preferredFilter`

**Reset:** clears `playerSearch`, `championSearch`, `classFilter`, `sagaFilter`, `preferredFilter`.

---

## i18n Keys

### New keys — `en.ts` / `fr.ts`

Under `game.defense`:
```ts
sagaDefenderFilter: 'Saga Defender',  // fr: 'Saga Défenseur'
notPreferredFilter: 'Not Preferred',  // fr: 'Non Préféré'
playerFilter: 'Player',               // fr: 'Joueur'
```

Under `game.war`:
```ts
sagaAttackerFilter: 'Saga Attacker',        // fr: 'Saga Attaquant'
preferredAttackerFilter: 'Preferred',       // fr: 'Préféré'
```

### Reused existing keys
- `t.roster.classFilter` — class dropdown label
- `t.roster.selectClass` — class dropdown placeholder
- `t.dashboard.resetFilters` — reset button label

---

## UI Components

- **Class dropdown**: shadcn `Select` from `@/components/ui/select`
- **Toggle filters**: shadcn `Button` variant `outline` with active state (`bg-primary/10 border-primary text-primary`)
- **Reset button**: shadcn `Button` variant `ghost` size `sm`, shown only when `canReset`

---

## Files Modified

| File | Change |
|---|---|
| `front/app/game/defense/_components/champion-selector.tsx` | Delete (replaced by alliance-defense-selector.tsx) |
| `front/app/game/defense/_components/alliance-defense-selector.tsx` | New file (renamed + extended) |
| `front/app/game/defense/_components/defense-grid.tsx` | Update import |
| `front/app/game/war/_components/war-attacker-selector.tsx` | Add filter bar |
| `front/app/i18n/locales/en.ts` | Add new i18n keys |
| `front/app/i18n/locales/fr.ts` | Add new i18n keys |

---

## Out of Scope

- Server-side pagination / API changes
- Page navigation controls (per-page, prev/next) — client-side filter only
- Modifying `PaginationControls` component
