# Frontend Consistency & Component Splitting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Homogenize all `game/` page structures, extract shared hooks, and split large components so no file exceeds 150 lines.

**Architecture:** Three sequential phases — (1) move page logic into `_components/` shells, (2) extract shared and domain hooks, (3) split remaining oversized components. Each phase leaves all tests passing before the next begins.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Cypress E2E

---

## Verification commands (used after every task)

```bash
# TypeScript check (run from front/)
cd front && npm run build

# Cypress E2E for a specific feature (run from repo root)
SPEC=cypress/e2e/<feature>/<spec>.cy.ts make e2e
```

---

## Phase 1 — Homogenize Structure

---

### Task 1: Extract `alliance-content.tsx` from `alliances/page.tsx`

**Files:**
- Create: `front/app/game/alliances/_components/alliance-content.tsx`
- Modify: `front/app/game/alliances/page.tsx`

**Goal:** `page.tsx` becomes a thin shell (like `defense/page.tsx`). All logic moves to `_components/alliance-content.tsx`.

- [ ] **Step 1: Create `alliance-content.tsx`**

  Create `front/app/game/alliances/_components/alliance-content.tsx`.
  Copy the entire `AlliancesContent` function from `page.tsx` and paste it as the default export, renaming it `AllianceContent`:

  ```tsx
  // front/app/game/alliances/_components/alliance-content.tsx
  'use client';
  // paste all imports from page.tsx here (everything except Suspense and dynamic)
  // paste all the AlliancesContent function body here, renamed to AllianceContent
  export default function AllianceContent() {
    // ... (all existing logic)
  }
  ```

  > The function body is identical — only the name and file location change.

- [ ] **Step 2: Replace `page.tsx` with a thin shell**

  Replace the entire content of `front/app/game/alliances/page.tsx` with:

  ```tsx
  import { Suspense } from 'react';
  import AllianceContent from './_components/alliance-content';

  export default function AlliancesPage() {
    return (
      <Suspense>
        <AllianceContent />
      </Suspense>
    );
  }
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd front && npm run build
  ```
  Expected: no TypeScript errors.

- [ ] **Step 4: Run alliances Cypress specs**

  ```bash
  SPEC=cypress/e2e/alliances/creation.cy.ts make e2e
  SPEC=cypress/e2e/alliances/invitations.cy.ts make e2e
  SPEC=cypress/e2e/alliances/permissions.cy.ts make e2e
  SPEC=cypress/e2e/alliances/groups.cy.ts make e2e
  SPEC=cypress/e2e/alliances/edge-cases.cy.ts make e2e
  ```
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add front/app/game/alliances/
  git commit -m "refactor: extract alliance-content from alliances page"
  ```

---

### Task 2: Extract `roster-content.tsx` from `roster/page.tsx`

**Files:**
- Create: `front/app/game/roster/_components/roster-content.tsx`
- Modify: `front/app/game/roster/page.tsx`

**Goal:** Same shell pattern as Task 1. `page.tsx` becomes a thin Suspense wrapper.

- [ ] **Step 1: Create `roster-content.tsx`**

  Create `front/app/game/roster/_components/roster-content.tsx`.

  Move the following from `page.tsx`:
  - The `RosterTab` enum
  - The `RosterUpgradeSection` inner component
  - The main page component, renamed to `RosterContent` and exported as default

  All imports follow the content.

  ```tsx
  // front/app/game/roster/_components/roster-content.tsx
  'use client';
  // paste all imports from page.tsx

  export enum RosterTab {
    Roster = 'roster',
    Accounts = 'accounts',
  }

  function RosterUpgradeSection(/* ... */) {
    // ... (unchanged)
  }

  export default function RosterContent() {
    // ... (all existing logic)
  }
  ```

- [ ] **Step 2: Replace `page.tsx` with a thin shell**

  ```tsx
  // front/app/game/roster/page.tsx
  import { Suspense } from 'react';
  import RosterContent from './_components/roster-content';

  export default function RosterPage() {
    return (
      <Suspense>
        <RosterContent />
      </Suspense>
    );
  }
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 4: Run roster Cypress specs**

  ```bash
  SPEC=cypress/e2e/roster/basic.cy.ts make e2e
  SPEC=cypress/e2e/roster/detailed-ui.cy.ts make e2e
  SPEC=cypress/e2e/roster/preferred-attacker.cy.ts make e2e
  SPEC=cypress/e2e/roster/upgrade-button.cy.ts make e2e
  SPEC=cypress/e2e/roster/upgrade-requests.cy.ts make e2e
  ```
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add front/app/game/roster/
  git commit -m "refactor: extract roster-content from roster page"
  ```

---

## Phase 2 — Shared Hooks

---

### Task 3: Create `useAllianceSelector` and integrate into `war-content.tsx`

**Files:**
- Create: `front/hooks/use-alliance-selector.ts`
- Modify: `front/app/game/war/_components/war-content.tsx`

**Goal:** Extract the alliance-fetch + selectedAllianceId/selectedBg state into a reusable hook. Integrate into `war-content.tsx` first.

- [ ] **Step 1: Create the hook**

  ```typescript
  // front/hooks/use-alliance-selector.ts
  import { useCallback, useEffect, useState } from 'react';
  import { type Alliance, getMyAlliances } from '@/app/services/game';

  export interface UseAllianceSelectorOptions {
    initialAllianceId?: string;
    initialBg?: number;
  }

  export interface UseAllianceSelectorReturn {
    alliances: Alliance[];
    selectedAllianceId: string;
    setSelectedAllianceId: (id: string) => void;
    selectedBg: number;
    setSelectedBg: (bg: number) => void;
    loading: boolean;
    refresh: () => Promise<void>;
  }

  export function useAllianceSelector(
    options: UseAllianceSelectorOptions = {}
  ): UseAllianceSelectorReturn {
    const { initialAllianceId = '', initialBg = 1 } = options;

    const [alliances, setAlliances] = useState<Alliance[]>([]);
    const [selectedAllianceId, setSelectedAllianceId] = useState<string>(initialAllianceId);
    const [selectedBg, setSelectedBg] = useState<number>(initialBg);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
      setLoading(true);
      try {
        const data = await getMyAlliances();
        setAlliances(data);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      refresh();
    }, [refresh]);

    return {
      alliances,
      selectedAllianceId,
      setSelectedAllianceId,
      selectedBg,
      setSelectedBg,
      loading,
      refresh,
    };
  }
  ```

- [ ] **Step 2: Integrate into `war-content.tsx`**

  In `front/app/game/war/_components/war-content.tsx`:

  1. Add import: `import { useAllianceSelector } from '@/hooks/use-alliance-selector';`
  2. Remove: the `const [alliances, setAlliances] = useState<Alliance[]>([])` declaration
  3. Remove: the `const [selectedAllianceId, setSelectedAllianceId] = useState<string>('')` declaration
  4. Remove: the `const [selectedBg, setSelectedBg] = useState<number>(1)` declaration
  5. Remove: the `fetchAlliances` function and its `useEffect`
  6. Remove: the `getMyAlliances` import from `@/app/services/game`
  7. Add at the top of the component body:
     ```typescript
     const {
       alliances,
       selectedAllianceId,
       setSelectedAllianceId,
       selectedBg,
       setSelectedBg,
     } = useAllianceSelector();
     ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 4: Run war Cypress specs**

  ```bash
  SPEC=cypress/e2e/war/basic.cy.ts make e2e
  SPEC=cypress/e2e/war/operations.cy.ts make e2e
  SPEC=cypress/e2e/war/management.cy.ts make e2e
  ```
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add front/hooks/use-alliance-selector.ts front/app/game/war/
  git commit -m "refactor: create useAllianceSelector hook and integrate into war"
  ```

---

### Task 4: Integrate `useAllianceSelector` into `defense-content.tsx`

**Files:**
- Modify: `front/app/game/defense/_components/defense-content.tsx`

**Note:** `defense-content.tsx` receives `initialAllianceId` and `initialBg` as props (passed from the shell page). The hook supports this via `options`.

- [ ] **Step 1: Update `defense-content.tsx`**

  1. Add import: `import { useAllianceSelector } from '@/hooks/use-alliance-selector';`
  2. Remove: `const [alliances, setAlliances] = useState<Alliance[]>([])` declaration
  3. Remove: `const [selectedAllianceId, setSelectedAllianceId] = useState<string>(initialAllianceId ?? '')`
  4. Remove: `const [selectedBg, setSelectedBg] = useState<number>(initialBg ?? 1)`
  5. Remove: the `fetchAlliances` function and its associated `useEffect`
  6. Remove: `getMyAlliances` from the `@/app/services/game` import (keep the `Alliance` type if still needed)
  7. Add at the top of the component body:
     ```typescript
     const {
       alliances,
       selectedAllianceId,
       setSelectedAllianceId,
       selectedBg,
       setSelectedBg,
     } = useAllianceSelector({ initialAllianceId, initialBg });
     ```

- [ ] **Step 2: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 3: Run defense Cypress specs**

  ```bash
  SPEC=cypress/e2e/defense/basic.cy.ts make e2e
  SPEC=cypress/e2e/defense/placement.cy.ts make e2e
  SPEC=cypress/e2e/defense/operations.cy.ts make e2e
  SPEC=cypress/e2e/defense/permissions.cy.ts make e2e
  SPEC=cypress/e2e/defense/overflow.cy.ts make e2e
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add front/app/game/defense/
  git commit -m "refactor: integrate useAllianceSelector into defense"
  ```

---

### Task 5: Integrate `useAllianceSelector` into `alliance-content.tsx`

**Files:**
- Modify: `front/app/game/alliances/_components/alliance-content.tsx`

- [ ] **Step 1: Update `alliance-content.tsx`**

  The alliances content manages `selectedAllianceId` locally (it drives URL params via `useRouter`). **Do NOT replace that state with the hook** — keep it as local `useState`. The hook only replaces the `alliances` list + fetch.

  1. Add import: `import { useAllianceSelector } from '@/hooks/use-alliance-selector';`
  2. Remove: `const [alliances, setAlliances] = useState<Alliance[]>([])` (and its setter usages — setAlliances is no longer needed)
  3. Remove: the `fetchAlliances` function and its `useEffect`
  4. Remove: `getMyAlliances` from service imports (keep other service imports)
  5. Add (destructure only `alliances` and `refresh`; keep the local `selectedAllianceId` and `selectedBg` state unchanged):
     ```typescript
     const { alliances, refresh: refreshAlliances } = useAllianceSelector();
     ```
  6. Replace any call to `fetchAlliances()` with `refreshAlliances()`.
  7. Verify `selectedAllianceId`, `setSelectedAllianceId`, `selectedBg`, `setSelectedBg` are still present as `useState` declarations — they are untouched by this task.

- [ ] **Step 2: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 3: Run alliances Cypress specs**

  ```bash
  SPEC=cypress/e2e/alliances/creation.cy.ts make e2e
  SPEC=cypress/e2e/alliances/invitations.cy.ts make e2e
  SPEC=cypress/e2e/alliances/permissions.cy.ts make e2e
  SPEC=cypress/e2e/alliances/groups.cy.ts make e2e
  SPEC=cypress/e2e/alliances/edge-cases.cy.ts make e2e
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add front/app/game/alliances/
  git commit -m "refactor: integrate useAllianceSelector into alliances"
  ```

---

### Task 6: Create `useWarActions` and integrate into `war-content.tsx`

**Files:**
- Create: `front/app/game/war/_hooks/use-war-actions.ts`
- Modify: `front/app/game/war/_components/war-content.tsx`

**Goal:** Extract all war business logic (state + async handlers) out of `war-content.tsx` into a dedicated hook.

- [ ] **Step 1: Read `war-content.tsx` in full**

  Open `front/app/game/war/_components/war-content.tsx` and identify:
  - All `useState` declarations (except `selectedAllianceId`, `selectedBg`, `alliances` — already moved to `useAllianceSelector`)
  - All handler functions (`handlePlaceDefender`, `handleRemoveDefender`, `handleClearBg`, `handleAssignAttacker`, `handleRemoveAttacker`, `handleCreateWar`, `handleEndWar`, `handleToggleKo`)
  - All `useEffect` blocks related to data fetching (`fetchWars`, `fetchWarDefense`)

- [ ] **Step 2: Create `use-war-actions.ts`**

  Create `front/app/game/war/_hooks/use-war-actions.ts`.

  The hook takes `selectedAllianceId` and `selectedBg` as parameters (provided by the component via `useAllianceSelector`) and returns all state + handlers:

  ```typescript
  // front/app/game/war/_hooks/use-war-actions.ts
  import { useCallback, useEffect, useRef, useState } from 'react';
  import { useI18n } from '@/app/i18n';
  import { toast } from 'sonner';
  import {
    type War,
    type WarDefenseSummary,
    type WarPlacement,
    getWars,
    createWar,
    endWar,
    getWarDefense,
    placeWarDefender,
    removeWarDefender,
    clearWarBg,
    assignWarAttacker,
    removeWarAttacker,
    updateWarKo,
  } from '@/app/services/war';

  export function useWarActions(selectedAllianceId: string, selectedBg: number) {
    const { t } = useI18n();

    // Paste all the useState declarations for wars, selectedWarId,
    // warSummary, loading, selectorNode, attackerSelectorNode,
    // clearConfirmOpen, createWarOpen here

    // Paste fetchWars, fetchWarDefense, and all useEffect blocks here

    // Paste all handler functions here

    return {
      wars,
      selectedWarId,
      setSelectedWarId,
      warSummary,
      loading,
      selectorNode,
      setSelectorNode,
      attackerSelectorNode,
      setAttackerSelectorNode,
      clearConfirmOpen,
      setClearConfirmOpen,
      createWarOpen,
      setCreateWarOpen,
      activeWarId,
      handlePlaceDefender,
      handleRemoveDefender,
      handleClearBg,
      handleAssignAttacker,
      handleRemoveAttacker,
      handleCreateWar,
      handleEndWar,
      handleToggleKo,
    };
  }
  ```

  > Move the code exactly as-is from `war-content.tsx`. Only adjust imports (remove the `useI18n` and toast imports from `war-content.tsx` if no longer needed there).

- [ ] **Step 3: Integrate into `war-content.tsx`**

  1. Add import: `import { useWarActions } from '../_hooks/use-war-actions';`
  2. Replace all the moved `useState`, `useEffect`, and handler declarations with:
     ```typescript
     const {
       wars, selectedWarId, setSelectedWarId,
       warSummary, loading,
       selectorNode, setSelectorNode,
       attackerSelectorNode, setAttackerSelectorNode,
       clearConfirmOpen, setClearConfirmOpen,
       createWarOpen, setCreateWarOpen,
       activeWarId,
       handlePlaceDefender, handleRemoveDefender, handleClearBg,
       handleAssignAttacker, handleRemoveAttacker,
       handleCreateWar, handleEndWar, handleToggleKo,
     } = useWarActions(selectedAllianceId, selectedBg);
     ```

- [ ] **Step 4: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 5: Run war Cypress specs**

  ```bash
  SPEC=cypress/e2e/war/basic.cy.ts make e2e
  SPEC=cypress/e2e/war/operations.cy.ts make e2e
  SPEC=cypress/e2e/war/management.cy.ts make e2e
  SPEC=cypress/e2e/war/attackers.cy.ts make e2e
  SPEC=cypress/e2e/war/war-attackers.cy.ts make e2e
  SPEC=cypress/e2e/war/war-status.cy.ts make e2e
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add front/app/game/war/
  git commit -m "refactor: extract useWarActions hook from war-content"
  ```

---

### Task 7: Create `useDefenseActions` and integrate into `defense-content.tsx`

**Files:**
- Create: `front/app/game/defense/_hooks/use-defense-actions.ts`
- Modify: `front/app/game/defense/_components/defense-content.tsx`

**Goal:** Same pattern as Task 6 for the defense page.

- [ ] **Step 1: Read `defense-content.tsx` in full**

  Open `front/app/game/defense/_components/defense-content.tsx` and identify:
  - All `useState` declarations except `selectedAllianceId`, `selectedBg`, `alliances`
  - All handler functions (`handlePlaceDefender`, `handleRemoveDefender`, `handleClearDefense`, `handleExportDefense`, `handleImportFile`)
  - The polling logic (`pollIntervalRef`, `resetPollTimer`, related `useEffect`)
  - `fetchDefense`, `fetchAvailableChampions`, `fetchBgMembers`

- [ ] **Step 2: Create `use-defense-actions.ts`**

  ```typescript
  // front/app/game/defense/_hooks/use-defense-actions.ts
  import { useCallback, useEffect, useRef, useState } from 'react';
  import { useI18n } from '@/app/i18n';
  import { toast } from 'sonner';
  import {
    type DefenseSummary,
    type AvailableChampion,
    type BgMember,
    type DefenseImportReport,
    getDefense,
    placeDefender,
    removeDefender,
    clearDefense,
    getAvailableChampions,
    getBgMembers,
    exportDefense,
    importDefense,
  } from '@/app/services/defense';

  export function useDefenseActions(
    selectedAllianceId: string,
    selectedBg: number,
    onStateChange?: (allianceId: string, bg: number) => void
    // onStateChange comes from defense-content's props (DefensePageContentProps).
    // It is passed down from defense/page.tsx to sync the URL when alliance/BG changes.
    // Pass it straight through from the component into this hook.
  ) {
    const { t } = useI18n();

    // Paste all the useState declarations for defenseSummary, availableChampions,
    // bgMembers, defenseLoading, selectorNode, clearConfirmOpen,
    // importReportOpen, importReport here

    // Paste the pollIntervalRef, resetPollTimer, and polling useEffects here

    // Paste fetchDefense, fetchAvailableChampions, fetchBgMembers here

    // Paste all handler functions here

    return {
      defenseSummary,
      availableChampions,
      bgMembers,
      defenseLoading,
      selectorNode,
      setSelectorNode,
      clearConfirmOpen,
      setClearConfirmOpen,
      importReportOpen,
      setImportReportOpen,
      importReport,
      fileInputRef,
      handlePlaceDefender,
      handleRemoveDefender,
      handleClearDefense,
      handleExportDefense,
      handleImportFile,
    };
  }
  ```

- [ ] **Step 3: Integrate into `defense-content.tsx`**

  1. Add import: `import { useDefenseActions } from '../_hooks/use-defense-actions';`
  2. Replace all moved declarations with:
     ```typescript
     const {
       defenseSummary, availableChampions, bgMembers, defenseLoading,
       selectorNode, setSelectorNode,
       clearConfirmOpen, setClearConfirmOpen,
       importReportOpen, setImportReportOpen, importReport,
       fileInputRef,
       handlePlaceDefender, handleRemoveDefender, handleClearDefense,
       handleExportDefense, handleImportFile,
     } = useDefenseActions(selectedAllianceId, selectedBg, onStateChange);
     ```

- [ ] **Step 4: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 5: Run defense Cypress specs**

  ```bash
  SPEC=cypress/e2e/defense/basic.cy.ts make e2e
  SPEC=cypress/e2e/defense/placement.cy.ts make e2e
  SPEC=cypress/e2e/defense/operations.cy.ts make e2e
  SPEC=cypress/e2e/defense/permissions.cy.ts make e2e
  SPEC=cypress/e2e/defense/overflow.cy.ts make e2e
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add front/app/game/defense/
  git commit -m "refactor: extract useDefenseActions hook from defense-content"
  ```

---

## Phase 3 — Component Splitting

---

### Task 8: Split `war-content.tsx` into sub-components

**Files:**
- Create: `front/app/game/war/_components/war-header.tsx`
- Create: `front/app/game/war/_components/war-defense-tab.tsx`
- Create: `front/app/game/war/_components/war-attacker-tab.tsx`
- Modify: `front/app/game/war/_components/war-content.tsx`

**Goal:** After Phase 2, `war-content.tsx` contains only JSX. Split it into 3 sub-components; `war-content.tsx` becomes a coordinator (~150L).

- [ ] **Step 1: Extract `WarHeader`**

  Create `front/app/game/war/_components/war-header.tsx`.

  Move the JSX block that renders:
  - Alliance selector (`<Select>` for alliance)
  - BG selector (`<Select>` for BG 1/2/3)
  - War selector (`<Select>` for active war)
  - "Create war" and "End war" buttons + `ConfirmationDialog`

  Define its props interface explicitly. Example:

  ```tsx
  // front/app/game/war/_components/war-header.tsx
  'use client';

  import { /* imports needed by this JSX */ } from '...';

  interface WarHeaderProps {
    alliances: Alliance[];
    selectedAllianceId: string;
    onAllianceChange: (id: string) => void;
    selectedBg: number;
    onBgChange: (bg: number) => void;
    wars: War[];
    selectedWarId: string | null;
    onWarChange: (id: string) => void;
    activeWarId: string | null;
    onCreateWar: (name: string) => Promise<void>;
    onEndWar: () => void;
    createWarOpen: boolean;
    setCreateWarOpen: (open: boolean) => void;
  }

  export default function WarHeader({ ... }: Readonly<WarHeaderProps>) {
    // paste the JSX block
  }
  ```

- [ ] **Step 2: Extract `WarDefenseTab`**

  Create `front/app/game/war/_components/war-defense-tab.tsx`.

  Move the JSX block for the defense tab (the part currently rendered when `activeTab === 'defense'`):
  - `<WarDefenseMap>` + `<WarChampionSelector>`
  - All props needed (warSummary, selectorNode, handlers)

  ```tsx
  interface WarDefenseTabProps {
    allianceId: string;
    warId: string;
    bg: number;
    warSummary: WarDefenseSummary | null;
    selectorNode: number | null;
    onNodeClick: (node: number) => void;
    onPlace: (node: number, championId: string, stars: number, rank: string, ascension: number) => Promise<void>;
    onRemove: (node: number) => Promise<void>;
    onClearBg: () => void;
    clearConfirmOpen: boolean;
    setClearConfirmOpen: (open: boolean) => void;
  }
  ```

- [ ] **Step 3: Extract `WarAttackerTab`**

  Create `front/app/game/war/_components/war-attacker-tab.tsx`.

  Move the JSX block for the attackers tab:
  - `<WarAttackerPanel>` + `<WarAttackerSelector>`

  ```tsx
  interface WarAttackerTabProps {
    allianceId: string;
    warId: string;
    bg: number;
    warSummary: WarDefenseSummary | null;
    attackerSelectorNode: number | null;
    onNodeClick: (node: number) => void;
    onAssign: (node: number, championUserId: string, championName: string) => Promise<void>;
    onRemove: (node: number) => Promise<void>;
    onToggleKo: (node: number, ko: boolean, championName: string) => Promise<void>;
  }
  ```

- [ ] **Step 4: Update `war-content.tsx` to use the 3 sub-components**

  `war-content.tsx` should now be a coordinator: import + render `<WarHeader>`, the tab bar, and `<WarDefenseTab>` or `<WarAttackerTab>` based on `activeTab`.

  Remove all the JSX that was moved. Add the 3 imports.

- [ ] **Step 5: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 6: Run all war Cypress specs**

  ```bash
  SPEC=cypress/e2e/war/basic.cy.ts make e2e
  SPEC=cypress/e2e/war/operations.cy.ts make e2e
  SPEC=cypress/e2e/war/management.cy.ts make e2e
  SPEC=cypress/e2e/war/attackers.cy.ts make e2e
  SPEC=cypress/e2e/war/war-attackers.cy.ts make e2e
  SPEC=cypress/e2e/war/war-status.cy.ts make e2e
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add front/app/game/war/
  git commit -m "refactor: split war-content into WarHeader, WarDefenseTab, WarAttackerTab"
  ```

---

### Task 9: Split `defense-content.tsx` into sub-components

**Files:**
- Create: `front/app/game/defense/_components/defense-header.tsx`
- Create: `front/app/game/defense/_components/defense-grid.tsx`
- Modify: `front/app/game/defense/_components/defense-content.tsx`

- [ ] **Step 1: Extract `DefenseHeader`**

  Create `front/app/game/defense/_components/defense-header.tsx`.

  Move the JSX block that renders:
  - Alliance selector
  - BG selector
  - Export / Import / Clear buttons

  ```tsx
  interface DefenseHeaderProps {
    alliances: Alliance[];
    selectedAllianceId: string;
    onAllianceChange: (id: string) => void;
    selectedBg: number;
    onBgChange: (bg: number) => void;
    onExport: () => void;
    onImportClick: () => void;
    onClearClick: () => void;
    canManage: boolean;
  }
  ```

- [ ] **Step 2: Extract `DefenseGrid`**

  Create `front/app/game/defense/_components/defense-grid.tsx`.

  Move the JSX block containing:
  - `<WarMap>` (the defense map)
  - `<ChampionSelector>` / `<DefenseSidePanel>`
  - `<ConfirmationDialog>` for clear
  - The hidden file input for import
  - `<DefenseImportReportDialog>`

  ```tsx
  interface DefenseGridProps {
    allianceId: string;
    bg: number;
    defenseSummary: DefenseSummary | null;
    availableChampions: AvailableChampion[];
    bgMembers: BgMember[];
    selectorNode: number | null;
    onNodeClick: (node: number) => void;
    onPlace: (node: number, championId: string, stars: number, rank: string, ascension: number) => Promise<void>;
    onRemove: (node: number) => Promise<void>;
    clearConfirmOpen: boolean;
    onClearConfirm: () => void;
    setClearConfirmOpen: (open: boolean) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    importReportOpen: boolean;
    importReport: DefenseImportReport | null;
    onImportReportClose: () => void;
    loading: boolean;
  }
  ```

- [ ] **Step 3: Update `defense-content.tsx`**

  Replace moved JSX blocks with `<DefenseHeader>` and `<DefenseGrid>`. Add the 2 imports.

- [ ] **Step 4: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 5: Run defense Cypress specs**

  ```bash
  SPEC=cypress/e2e/defense/basic.cy.ts make e2e
  SPEC=cypress/e2e/defense/placement.cy.ts make e2e
  SPEC=cypress/e2e/defense/operations.cy.ts make e2e
  SPEC=cypress/e2e/defense/permissions.cy.ts make e2e
  SPEC=cypress/e2e/defense/overflow.cy.ts make e2e
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add front/app/game/defense/
  git commit -m "refactor: split defense-content into DefenseHeader and DefenseGrid"
  ```

---

### Task 10: Split `alliance-content.tsx` into sub-components

**Files:**
- Create: `front/app/game/alliances/_components/invitations-section.tsx`
- Create: `front/app/game/alliances/_components/alliances-tab.tsx`
- Modify: `front/app/game/alliances/_components/alliance-content.tsx`

- [ ] **Step 1: Extract `InvitationsSection`**

  Create `front/app/game/alliances/_components/invitations-section.tsx`.

  Move the JSX block that renders `myInvitations` (the `<Card data-cy='my-invitations-section'>` block, ~60 lines):

  ```tsx
  interface InvitationsSectionProps {
    invitations: AllianceInvitation[];
    onAccept: (id: string) => Promise<void>;
    onDecline: (id: string) => Promise<void>;
  }

  export default function InvitationsSection({ invitations, onAccept, onDecline }: Readonly<InvitationsSectionProps>) {
    // paste JSX block
  }
  ```

- [ ] **Step 2: Extract `AlliancesTab`**

  Create `front/app/game/alliances/_components/alliances-tab.tsx`.

  Move the JSX block for `AllianceTab.Alliances` (the map over `alliances` + empty state):

  ```tsx
  interface AlliancesTabProps {
    alliances: Alliance[];
    // all props passed down to AllianceCard
    locale: string;
    memberAllianceId: string | null;
    memberAccountId: string;
    eligibleMembers: GameAccount[];
    pendingInvitations: Record<string, AllianceInvitation[]>;
    onMemberAccountChange: (id: string) => void;
    onOpenInviteMember: (allianceId: string) => void;
    onCloseInviteMember: () => void;
    onInviteMember: () => Promise<void>;
    onRefresh: () => void;
    onViewRoster: (gameAccountId: string, pseudo: string, canReq: boolean) => void;
    onCancelInvitation: (id: string) => Promise<void>;
  }
  ```

- [ ] **Step 3: Update `alliance-content.tsx`**

  Replace moved JSX with `<InvitationsSection>` and `<AlliancesTab>`. Add the 2 imports.

- [ ] **Step 4: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 5: Run alliances Cypress specs**

  ```bash
  SPEC=cypress/e2e/alliances/creation.cy.ts make e2e
  SPEC=cypress/e2e/alliances/invitations.cy.ts make e2e
  SPEC=cypress/e2e/alliances/permissions.cy.ts make e2e
  SPEC=cypress/e2e/alliances/groups.cy.ts make e2e
  SPEC=cypress/e2e/alliances/edge-cases.cy.ts make e2e
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add front/app/game/alliances/
  git commit -m "refactor: split alliance-content into InvitationsSection and AlliancesTab"
  ```

---

### Task 11: Extract `useRosterImportExport` from `roster-import-export.tsx`

**Files:**
- Create: `front/components/use-roster-import-export.ts`
- Modify: `front/components/roster-import-export.tsx`

**Goal:** Separate import/export business logic from the component rendering.

- [ ] **Step 1: Read `roster-import-export.tsx` in full**

  Identify:
  - All `useState` declarations (previewRows, importResult, isPreviewOpen, isReportOpen, etc.)
  - All handler functions (handleExport, handleImportClick, handlePreviewConfirm, etc.)
  - The `validateEntry` helper function
  - The file input ref

- [ ] **Step 2: Create `use-roster-import-export.ts`**

  ```typescript
  // front/components/use-roster-import-export.ts
  import { useCallback, useRef, useState } from 'react';
  import { toast } from 'sonner';
  import { useI18n } from '@/app/i18n';
  import { /* service imports */ } from '@/app/services/roster';

  // Move validateEntry here (it's a pure function, not a hook)
  function validateEntry(...) { ... }

  export interface UseRosterImportExportProps {
    accountId: string;
    onSuccess: (entries: RosterEntry[]) => void;
  }

  export function useRosterImportExport({ accountId, onSuccess }: UseRosterImportExportProps) {
    // paste all useState declarations
    // paste fileInputRef
    // paste all handler functions

    return {
      // expose all state, refs, and handlers needed by the component
    };
  }
  ```

- [ ] **Step 3: Update `roster-import-export.tsx`**

  1. Import the hook: `import { useRosterImportExport } from './use-roster-import-export';`
  2. Remove all moved state, refs, handlers, and `validateEntry`
  3. Replace with a single hook call:
     ```typescript
     const { fileInputRef, previewRows, isPreviewOpen, ..., handleExport, handleImportClick, ... } = useRosterImportExport({ accountId, onSuccess });
     ```
  4. The component now contains only JSX + the hook call.

- [ ] **Step 4: Verify build passes**

  ```bash
  cd front && npm run build
  ```

- [ ] **Step 5: Run roster Cypress specs**

  ```bash
  SPEC=cypress/e2e/roster/basic.cy.ts make e2e
  SPEC=cypress/e2e/roster/detailed-ui.cy.ts make e2e
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add front/components/
  git commit -m "refactor: extract useRosterImportExport hook from roster-import-export"
  ```

---

## Final Verification

- [ ] **Run full E2E suite**

  ```bash
  make e2e
  ```
  Expected: all specs pass.

- [ ] **Run TypeScript build**

  ```bash
  cd front && npm run build
  ```
  Expected: no errors.

- [ ] **Check no file in `_components/` exceeds 150 lines**

  ```bash
  find front/app/game -path '*/_components/*.tsx' | xargs wc -l | sort -rn | head -20
  ```

---

## File Inventory Summary

| File | Status |
|------|--------|
| `front/hooks/use-alliance-selector.ts` | Create |
| `front/components/use-roster-import-export.ts` | Create |
| `front/app/game/war/_hooks/use-war-actions.ts` | Create |
| `front/app/game/defense/_hooks/use-defense-actions.ts` | Create |
| `front/app/game/alliances/_components/alliance-content.tsx` | Create |
| `front/app/game/alliances/_components/invitations-section.tsx` | Create |
| `front/app/game/alliances/_components/alliances-tab.tsx` | Create |
| `front/app/game/roster/_components/roster-content.tsx` | Create |
| `front/app/game/war/_components/war-header.tsx` | Create |
| `front/app/game/war/_components/war-defense-tab.tsx` | Create |
| `front/app/game/war/_components/war-attacker-tab.tsx` | Create |
| `front/app/game/defense/_components/defense-header.tsx` | Create |
| `front/app/game/defense/_components/defense-grid.tsx` | Create |
| `front/app/game/alliances/page.tsx` | Modify (thinned) |
| `front/app/game/roster/page.tsx` | Modify (thinned) |
| `front/app/game/war/_components/war-content.tsx` | Modify (coordinator) |
| `front/app/game/defense/_components/defense-content.tsx` | Modify (coordinator) |
| `front/components/roster-import-export.tsx` | Modify (view only) |
