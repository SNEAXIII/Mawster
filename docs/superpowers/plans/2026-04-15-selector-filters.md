# Selector Filters & Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side filter bars (class, player, saga, preferred) to `AllianceDefenseSelector` and `WarAttackerSelector`, extract shared `SelectorFilterBar` UI component, and rename `ChampionSelector` → `AllianceDefenseSelector`.

**Architecture:** Filter state lives inline in each dialog component (criteria differ). A shared stateless `SelectorFilterBar` renders the class dropdown, player dropdown (optional), toggle buttons, and reset button. All filtering is client-side via `useMemo`/`Array.filter` on already-loaded data.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, shadcn/ui (`Select`, `Button`), `useI18n()`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `front/app/i18n/locales/en.ts` | Modify | Add 5 new i18n keys |
| `front/app/i18n/locales/fr.ts` | Modify | Add 5 new i18n keys (FR) |
| `front/app/game/_components/selector-filter-bar.tsx` | Create | Shared stateless filter bar UI |
| `front/app/game/defense/_components/alliance-defense-selector.tsx` | Create | Renamed + extended ChampionSelector |
| `front/app/game/defense/_components/champion-selector.tsx` | Delete | Replaced by alliance-defense-selector.tsx |
| `front/app/game/defense/_components/defense-grid.tsx` | Modify | Update import |
| `front/app/game/war/_components/war-attacker-selector.tsx` | Modify | Add filter state + SelectorFilterBar |

---

### Task 1: Add i18n keys

**Files:**
- Modify: `front/app/i18n/locales/en.ts`
- Modify: `front/app/i18n/locales/fr.ts`

- [ ] **Step 1: Add keys to en.ts — defense section**

In `en.ts`, find line `preferredAttackerWarning: 'Preferred attacker',` (inside `game.defense`). Add 3 keys after it, before `importExport:`:

```ts
      preferredAttackerWarning: 'Preferred attacker',
      sagaDefenderFilter: 'Saga Defender',
      notPreferredFilter: 'Not Preferred',
      playerFilter: 'Player',
      importExport: {
```

- [ ] **Step 2: Add keys to en.ts — war section**

In `en.ts`, find `memberAttackers: '{count}/3',` (inside `game.war`). Add 2 keys after it:

```ts
      memberAttackers: '{count}/3',
      sagaAttackerFilter: 'Saga Attacker',
      preferredAttackerFilter: 'Preferred',
      synergy: {
```

- [ ] **Step 3: Add keys to fr.ts — defense section**

In `fr.ts`, find `preferredAttackerWarning:` inside `game.defense`. Add 3 keys after it, before `importExport:`:

```ts
      preferredAttackerWarning: 'Attaquant préféré',
      sagaDefenderFilter: 'Saga Défenseur',
      notPreferredFilter: 'Non Préféré',
      playerFilter: 'Joueur',
      importExport: {
```

- [ ] **Step 4: Add keys to fr.ts — war section**

In `fr.ts`, find `memberAttackers:` inside `game.war`. Add 2 keys after it, before `synergy:`:

```ts
      memberAttackers: '{count}/3',
      sagaAttackerFilter: 'Saga Attaquant',
      preferredAttackerFilter: 'Préféré',
      synergy: {
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /root/Mawster/front && npm run build 2>&1 | tail -20
```

Expected: no TS errors about missing i18n keys.

- [ ] **Step 6: Commit**

```bash
git add front/app/i18n/locales/en.ts front/app/i18n/locales/fr.ts
git commit -m "feat: add i18n keys for selector filter bars"
```

---

### Task 2: Create shared SelectorFilterBar component

**Files:**
- Create: `front/app/game/_components/selector-filter-bar.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /root/Mawster/front/app/game/_components
```

- [ ] **Step 2: Write the component**

Create `front/app/game/_components/selector-filter-bar.tsx`:

```tsx
'use client';

import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/app/lib/utils';

export interface ToggleConfig {
  key: string;
  label: string;
  active: boolean;
  onToggle: (v: boolean) => void;
}

interface SelectorFilterBarProps {
  classes: string[];
  classFilter: string;
  onClassChange: (v: string) => void;
  players?: string[];
  playerFilter?: string;
  onPlayerChange?: (v: string) => void;
  toggles: ToggleConfig[];
  canReset: boolean;
  onReset: () => void;
}

export default function SelectorFilterBar({
  classes,
  classFilter,
  onClassChange,
  players,
  playerFilter,
  onPlayerChange,
  toggles,
  canReset,
  onReset,
}: Readonly<SelectorFilterBarProps>) {
  const { t } = useI18n();

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {players && players.length > 0 && onPlayerChange && (
        <Select
          value={playerFilter || 'all'}
          onValueChange={(val) => onPlayerChange(val === 'all' ? '' : val)}
        >
          <SelectTrigger className='h-8 w-36 text-xs'>
            <SelectValue placeholder={t.game.defense.playerFilter} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t.game.defense.playerFilter}</SelectItem>
            {players.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {classes.length > 0 && (
        <Select
          value={classFilter || 'all'}
          onValueChange={(val) => onClassChange(val === 'all' ? '' : val)}
        >
          <SelectTrigger className='h-8 w-36 text-xs'>
            <SelectValue placeholder={t.roster.selectClass} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t.roster.classFilter}</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {toggles.map((toggle) => (
        <Button
          key={toggle.key}
          variant='outline'
          size='sm'
          className={cn(
            'h-8 text-xs',
            toggle.active && 'bg-primary/10 border-primary text-primary'
          )}
          onClick={() => toggle.onToggle(!toggle.active)}
        >
          {toggle.label}
        </Button>
      ))}

      {canReset && (
        <Button
          variant='ghost'
          size='sm'
          className='h-8 text-xs text-muted-foreground'
          onClick={onReset}
        >
          {t.dashboard.resetFilters}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /root/Mawster/front && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add front/app/game/_components/selector-filter-bar.tsx
git commit -m "feat: add shared SelectorFilterBar component"
```

---

### Task 3: Create AllianceDefenseSelector (rename + filters)

**Files:**
- Create: `front/app/game/defense/_components/alliance-defense-selector.tsx`

- [ ] **Step 1: Create the new file**

Create `front/app/game/defense/_components/alliance-defense-selector.tsx` with the full content below. This is `champion-selector.tsx` renamed + extended with filter state and `SelectorFilterBar`.

```tsx
'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useI18n } from '@/app/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/search-input';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { type AvailableChampion, type ChampionOwner, type DefensePlacement } from '@/app/services/defense';
import { RARITY_LABELS, getClassColors, shortenChampionName } from '@/app/services/roster';
import { Separator } from '@/components/ui/separator';
import SelectorFilterBar from '@/app/game/_components/selector-filter-bar';

interface AllianceDefenseSelectorProps {
  open: boolean;
  onClose: () => void;
  nodeNumber: number;
  availableChampions: AvailableChampion[];
  onSelect: (championUserId: string, gameAccountId: string, championName: string) => void;
  currentPlacement?: DefensePlacement;
}

export default function AllianceDefenseSelector({
  open,
  onClose,
  nodeNumber,
  availableChampions,
  onSelect,
  currentPlacement,
}: Readonly<AllianceDefenseSelectorProps>) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [sagaFilter, setSagaFilter] = useState(false);
  const [notPreferredFilter, setNotPreferredFilter] = useState(false);
  const [selectedChampion, setSelectedChampion] = useState<AvailableChampion | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availableClasses = useMemo(() => {
    const classes = new Set(availableChampions.map((c) => c.champion_class));
    return Array.from(classes).sort();
  }, [availableChampions]);

  const availablePlayers = useMemo(() => {
    const players = new Set(availableChampions.flatMap((c) => c.owners.map((o) => o.game_pseudo)));
    return Array.from(players).sort();
  }, [availableChampions]);

  const canReset =
    search !== '' || classFilter !== '' || playerFilter !== '' || sagaFilter || notPreferredFilter;

  const filtered = useMemo(() => {
    return availableChampions.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search.trim() ||
        c.champion_name.toLowerCase().includes(q) ||
        c.champion_class.toLowerCase().includes(q) ||
        (c.champion_alias ?? '').toLowerCase().includes(q);
      const matchClass = !classFilter || c.champion_class === classFilter;
      const matchPlayer =
        !playerFilter || c.owners.some((o) => o.game_pseudo === playerFilter);
      const matchSaga = !sagaFilter || c.is_saga_defender;
      const matchNotPreferred =
        !notPreferredFilter || c.owners.every((o) => !o.is_preferred_attacker);
      return matchSearch && matchClass && matchPlayer && matchSaga && matchNotPreferred;
    });
  }, [search, classFilter, playerFilter, sagaFilter, notPreferredFilter, availableChampions]);

  // Defer rendering of the grid by one frame so the dialog open animation is smooth
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
    setReady(false);
  }, [open]);

  const handleSelectChampion = (champ: AvailableChampion) => {
    if (champ.owners.length === 1) {
      const owner = champ.owners[0];
      onSelect(owner.champion_user_id, owner.game_account_id, champ.champion_name);
      handleClose();
    } else {
      setSelectedChampion(champ);
    }
  };

  const handleSelectOwner = (owner: ChampionOwner, championName: string) => {
    onSelect(owner.champion_user_id, owner.game_account_id, championName);
    handleClose();
  };

  const handleClose = () => {
    setSearch('');
    setClassFilter('');
    setPlayerFilter('');
    setSagaFilter(false);
    setNotPreferredFilter(false);
    setSelectedChampion(null);
    onClose();
  };

  const handleReset = () => {
    setSearch('');
    setClassFilter('');
    setPlayerFilter('');
    setSagaFilter(false);
    setNotPreferredFilter(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && handleClose()}
    >
      <DialogContent
        className='max-w-2xl max-h-[80vh] overflow-hidden flex flex-col'
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {selectedChampion
              ? `${t.game.defense.selectPlayer} — ${shortenChampionName(selectedChampion.champion_name)}`
              : `${t.game.defense.selectChampion} — Node #${nodeNumber}`}
          </DialogTitle>
        </DialogHeader>

        <Separator />
        <div className='px-6 py-3 flex items-center gap-3' data-cy='defense-current-placement'>
          {currentPlacement ? (
            <>
              <ChampionPortrait
                imageUrl={currentPlacement.champion_image_url}
                name={currentPlacement.champion_name}
                rarity={currentPlacement.rarity}
                size={44}
                ascension={currentPlacement.ascension}
                is_saga_attacker={currentPlacement.is_saga_attacker}
                is_saga_defender={currentPlacement.is_saga_defender}
                sagaMode='defender'
              />
              <div className='min-w-0'>
                <div className='text-sm font-medium truncate'>{currentPlacement.champion_name}</div>
                <div className='text-xs text-muted-foreground'>
                  {currentPlacement.game_pseudo} · #{currentPlacement.node_number}
                </div>
              </div>
            </>
          ) : (
            <div className='text-sm text-muted-foreground'>
              {t.game.defense.nodeEmpty.replace('{node}', String(nodeNumber))}
            </div>
          )}
        </div>
        <Separator />

        {!selectedChampion ? (
          <>
            <SearchInput
              ref={searchInputRef}
              placeholder={t.roster.searchChampion}
              value={search}
              onChange={(val) => setSearch(val)}
              className='mb-2'
            />
            <SelectorFilterBar
              classes={availableClasses}
              classFilter={classFilter}
              onClassChange={setClassFilter}
              players={availablePlayers}
              playerFilter={playerFilter}
              onPlayerChange={setPlayerFilter}
              toggles={[
                {
                  key: 'saga',
                  label: t.game.defense.sagaDefenderFilter,
                  active: sagaFilter,
                  onToggle: setSagaFilter,
                },
                {
                  key: 'notPreferred',
                  label: t.game.defense.notPreferredFilter,
                  active: notPreferredFilter,
                  onToggle: setNotPreferredFilter,
                },
              ]}
              canReset={canReset}
              onReset={handleReset}
            />
            <div className='overflow-y-auto flex-1 pr-1 mt-3'>
              {!ready ? (
                <p className='text-muted-foreground text-sm text-center py-8'>{t.common.loading}</p>
              ) : filtered.length === 0 ? (
                <p className='text-muted-foreground text-sm text-center py-8'>
                  {t.game.defense.noChampionsAvailable}
                </p>
              ) : (
                <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
                  {filtered.map((champ) => {
                    const classColors = getClassColors(champ.champion_class);
                    const bestOwner = champ.owners[0];
                    return (
                      <button
                        key={champ.champion_id}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                          'hover:ring-2 hover:ring-white/40 cursor-pointer',
                          'bg-card border-border'
                        )}
                        onClick={() => handleSelectChampion(champ)}
                        title={`${champ.champion_name} — ${champ.owners.length} owner(s)`}
                        data-cy={`champion-card-${champ.champion_name.replaceAll(/\s+/g, '-')}`}
                      >
                        <ChampionPortrait
                          imageUrl={champ.image_url}
                          name={champ.champion_name}
                          rarity={bestOwner.rarity}
                          size={48}
                          isPreferred={champ.owners.every((o) => o.is_preferred_attacker)}
                          ascension={bestOwner.ascension}
                          is_saga_attacker={champ.is_saga_attacker}
                          is_saga_defender={champ.is_saga_defender}
                          sagaMode='defender'
                        />
                        <span className='text-[10px] text-center truncate w-full leading-tight'>
                          {shortenChampionName(champ.champion_name)}
                        </span>
                        <span className={cn('text-[9px] font-medium', classColors.label)}>
                          {RARITY_LABELS[bestOwner.rarity] ?? bestOwner.rarity}
                          {bestOwner.ascension > 0 && (
                            <span className='text-purple-400 font-semibold'>
                              {' '}
                              · A{bestOwner.ascension}
                            </span>
                          )}
                        </span>
                        {champ.owners.length === 1 ? (
                          <span className='text-[9px] text-muted-foreground truncate w-full text-center'>
                            {bestOwner.game_pseudo} · {bestOwner.defender_count}/5
                          </span>
                        ) : (
                          <span className='text-[9px] text-muted-foreground'>
                            {t.game.defense.ownersCount.replace(
                              '{count}',
                              String(champ.owners.length)
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className='overflow-y-auto flex-1'>
            <Button
              variant='ghost'
              size='sm'
              className='mb-3'
              onClick={() => setSelectedChampion(null)}
            >
              ← {t.common.back}
            </Button>
            <div className='space-y-2'>
              {selectedChampion.owners.map((owner) => (
                <button
                  key={owner.champion_user_id}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                    'hover:ring-2 hover:ring-white/40 cursor-pointer',
                    'bg-card border-border',
                    owner.defender_count >= 5 && 'opacity-40 pointer-events-none'
                  )}
                  onClick={() => handleSelectOwner(owner, selectedChampion.champion_name)}
                  disabled={owner.defender_count >= 5}
                  data-cy={`owner-row-${owner.game_pseudo}`}
                >
                  <ChampionPortrait
                    imageUrl={selectedChampion.image_url}
                    name={selectedChampion.champion_name}
                    rarity={owner.rarity}
                    size={44}
                    isPreferred={owner.is_preferred_attacker}
                    ascension={owner.ascension}
                    is_saga_attacker={selectedChampion.is_saga_attacker}
                    is_saga_defender={selectedChampion.is_saga_defender}
                    sagaMode='defender'
                  />
                  <div className='flex flex-col items-start'>
                    <span className='font-medium text-sm'>{owner.game_pseudo}</span>
                    <span className='text-xs text-muted-foreground'>
                      {RARITY_LABELS[owner.rarity] ?? owner.rarity}
                      {owner.ascension > 0 && (
                        <span className='text-purple-400 font-semibold'> · A{owner.ascension}</span>
                      )}
                      {' · '}
                      sig {owner.signature}
                    </span>
                    <span className='text-[10px] text-muted-foreground'>
                      {t.game.defense.defendersPlaced}: {owner.defender_count}/5
                    </span>
                  </div>
                  {owner.stars === 7 && (
                    <span className='ml-auto text-xs font-bold text-yellow-400'>7★</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /root/Mawster/front && npm run build 2>&1 | tail -20
```

Expected: no errors in `alliance-defense-selector.tsx`.

- [ ] **Step 3: Commit**

```bash
git add front/app/game/defense/_components/alliance-defense-selector.tsx
git commit -m "feat: add AllianceDefenseSelector with class/player/saga/notPreferred filters"
```

---

### Task 4: Update defense-grid.tsx import + delete old file

**Files:**
- Modify: `front/app/game/defense/_components/defense-grid.tsx`
- Delete: `front/app/game/defense/_components/champion-selector.tsx`

- [ ] **Step 1: Update import in defense-grid.tsx**

In `front/app/game/defense/_components/defense-grid.tsx`, find:

```ts
import ChampionSelector from './champion-selector';
```

Replace with:

```ts
import AllianceDefenseSelector from './alliance-defense-selector';
```

Also replace every JSX usage of `<ChampionSelector` with `<AllianceDefenseSelector` in the same file (there should be one occurrence).

- [ ] **Step 2: Delete old file**

```bash
git rm front/app/game/defense/_components/champion-selector.tsx
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /root/Mawster/front && npm run build 2>&1 | tail -20
```

Expected: no errors about missing `champion-selector`.

- [ ] **Step 4: Commit**

```bash
git add front/app/game/defense/_components/defense-grid.tsx
git commit -m "refactor: rename ChampionSelector to AllianceDefenseSelector"
```

---

### Task 5: Add filters to WarAttackerSelector

**Files:**
- Modify: `front/app/game/war/_components/war-attacker-selector.tsx`

- [ ] **Step 1: Add import for SelectorFilterBar**

At the top of `war-attacker-selector.tsx`, add:

```ts
import SelectorFilterBar from '@/app/game/_components/selector-filter-bar';
```

- [ ] **Step 2: Add filter state**

After the existing `const [error, setError] = useState(false);` line, add:

```ts
const [classFilter, setClassFilter] = useState('');
const [sagaFilter, setSagaFilter] = useState(false);
const [preferredFilter, setPreferredFilter] = useState(false);
```

- [ ] **Step 3: Reset filters on dialog open**

In the `useEffect` that runs when `open` changes, add resets after the existing ones:

```ts
useEffect(() => {
  if (open) {
    fetchAvailable();
    setPlayerSearch('');
    setChampionSearch('');
    setClassFilter('');
    setSagaFilter(false);
    setPreferredFilter(false);
  }
}, [open, fetchAvailable]);
```

- [ ] **Step 4: Add availableClasses + canReset**

After the `assignedByPseudo` map (before the `filtered` declaration), add:

```ts
const availableClasses = useMemo(
  () => Array.from(new Set(available.map((a) => a.champion_class))).sort(),
  [available]
);

const canReset =
  playerSearch !== '' ||
  championSearch !== '' ||
  classFilter !== '' ||
  sagaFilter ||
  preferredFilter;
```

Note: `useMemo` requires adding it to the imports at the top — change:

```ts
import { useCallback, useEffect, useState } from 'react';
```

to:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
```

- [ ] **Step 5: Extend filtered logic**

Replace the existing `filtered` declaration:

```ts
const filtered = available.filter((a) => {
  const matchPlayer =
    !playerSearch || a.game_pseudo.toLowerCase().includes(playerSearch.toLowerCase());
  const alias = (a.champion_alias ?? '').toLowerCase();
  const matchChampion =
    !championSearch
    || a.champion_name.toLowerCase().includes(championSearch.toLowerCase())
    || alias.includes(championSearch.toLowerCase());
  return matchPlayer && matchChampion;
});
```

With:

```ts
const filtered = available.filter((a) => {
  const matchPlayer =
    !playerSearch || a.game_pseudo.toLowerCase().includes(playerSearch.toLowerCase());
  const alias = (a.champion_alias ?? '').toLowerCase();
  const matchChampion =
    !championSearch ||
    a.champion_name.toLowerCase().includes(championSearch.toLowerCase()) ||
    alias.includes(championSearch.toLowerCase());
  const matchClass = !classFilter || a.champion_class === classFilter;
  const matchSaga = !sagaFilter || a.is_saga_attacker;
  const matchPreferred = !preferredFilter || a.is_preferred_attacker;
  return matchPlayer && matchChampion && matchClass && matchSaga && matchPreferred;
});
```

- [ ] **Step 6: Add handleReset + SelectorFilterBar in JSX**

Add a `handleReset` function before the `return` statement:

```ts
const handleReset = () => {
  setPlayerSearch('');
  setChampionSearch('');
  setClassFilter('');
  setSagaFilter(false);
  setPreferredFilter(false);
};
```

Then in JSX, find the search bar section:

```tsx
<div className='px-4 py-3 flex gap-2'>
  <SearchInput
    value={playerSearch}
    onChange={setPlayerSearch}
    placeholder={t.game.war.searchPlayer}
    data-cy='war-attacker-search-player'
  />
  <SearchInput
    value={championSearch}
    onChange={setChampionSearch}
    placeholder={t.game.war.searchChampion}
    data-cy='war-attacker-search-champion'
  />
</div>
```

Replace with:

```tsx
<div className='px-4 py-3 flex flex-col gap-2'>
  <div className='flex gap-2'>
    <SearchInput
      value={playerSearch}
      onChange={setPlayerSearch}
      placeholder={t.game.war.searchPlayer}
      data-cy='war-attacker-search-player'
    />
    <SearchInput
      value={championSearch}
      onChange={setChampionSearch}
      placeholder={t.game.war.searchChampion}
      data-cy='war-attacker-search-champion'
    />
  </div>
  <SelectorFilterBar
    classes={availableClasses}
    classFilter={classFilter}
    onClassChange={setClassFilter}
    toggles={[
      {
        key: 'saga',
        label: t.game.war.sagaAttackerFilter,
        active: sagaFilter,
        onToggle: setSagaFilter,
      },
      {
        key: 'preferred',
        label: t.game.war.preferredAttackerFilter,
        active: preferredFilter,
        onToggle: setPreferredFilter,
      },
    ]}
    canReset={canReset}
    onReset={handleReset}
  />
</div>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /root/Mawster/front && npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add front/app/game/war/_components/war-attacker-selector.tsx
git commit -m "feat: add class/saga/preferred filters to WarAttackerSelector"
```

---

## Self-Review Checklist

- [x] i18n keys added for both locales (en + fr) — Task 1
- [x] `SelectorFilterBar` created with class/player dropdowns, toggles, reset — Task 2
- [x] `AllianceDefenseSelector` created with all 4 filter states + full filter logic — Task 3
- [x] `defense-grid.tsx` import updated + old file deleted — Task 4
- [x] `WarAttackerSelector` extended with 3 filter states + `SelectorFilterBar` — Task 5
- [x] All `useMemo` imports present where needed
- [x] `handleClose` resets all filter state in `AllianceDefenseSelector`
- [x] `useEffect` resets all filter state in `WarAttackerSelector` on dialog open
- [x] No placeholders or TBDs
