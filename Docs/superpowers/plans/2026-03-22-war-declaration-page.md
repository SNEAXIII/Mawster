# War Declaration — Page Guerre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move war declaration (declare + end war) to the war page as a management bar visible only to officers/owners, with no tabs and no war selector.

**Architecture:** A new `war-management-bar.tsx` component handles the declare/end UI. `war-content.tsx` is refactored to inline its own war fetch/create/end logic (removing the cross-page `useCurrentWar` import). Cypress tests are updated to remove all tab-click navigation and update selectors.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, shadcn/ui, Cypress E2E

**Spec:** `docs/superpowers/specs/2026-03-22-war-declaration-page-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `front/app/game/war/_components/war-management-bar.tsx` | **Create** | Declare/End war UI for canManage users |
| `front/app/game/war/_components/war-content.tsx` | **Modify** | Remove `useCurrentWar`, inline war state/actions, render management bar |
| `front/cypress/e2e/war/basic.cy.ts` | **Modify** | Remove tab clicks, update selectors, rename tests |
| `front/cypress/e2e/war/operations.cy.ts` | **Modify** | Remove tab clicks, replace `war-select` assertion |
| `front/cypress/e2e/war/war-attackers.cy.ts` | **Modify** | Remove tab clicks (6 tests) |
| `front/cypress/e2e/war/war-status.cy.ts` | **Modify** | Remove tab click, update assertion to `noWar` text |
| `front/cypress/e2e/war/attackers.cy.ts` | **Modify** | Update implementation comment only |
| `front/cypress/e2e/war/war-management.cy.ts` | **Create** | New test: officer can end a war |

---

## Task 1: Create `war-management-bar.tsx`

**Files:**
- Create: `front/app/game/war/_components/war-management-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import type { War } from '@/app/services/war';

interface WarManagementBarProps {
  activeWar: War | null;
  loading: boolean;
  onClickDeclare: () => void;
  onClickEndWar: () => void;
}

export default function WarManagementBar({
  activeWar,
  loading,
  onClickDeclare,
  onClickEndWar,
}: WarManagementBarProps) {
  const { t } = useI18n();

  if (loading) {
    return <div className='h-9 w-48 bg-muted animate-pulse rounded' />;
  }

  if (!activeWar) {
    return (
      <div className='flex items-center gap-3'>
        <p className='text-muted-foreground text-sm'>{t.game.war.noWar}</p>
        <Button
          onClick={onClickDeclare}
          data-cy='declare-war-btn'
        >
          {t.game.war.declareWar}
        </Button>
      </div>
    );
  }

  return (
    <div className='flex items-center gap-3'>
      <div className='flex items-center gap-2'>
        <Swords className='w-4 h-4 text-muted-foreground' />
        <span
          className='text-sm font-semibold'
          data-cy='war-opponent-name'
        >
          vs {activeWar.opponent_name}
        </span>
      </div>
      <Button
        variant='destructive'
        onClick={onClickEndWar}
        data-cy='end-war-btn'
      >
        {t.game.war.endWar}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd front && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add front/app/game/war/_components/war-management-bar.tsx
git commit -m "feat: add WarManagementBar component (declare/end war)"
```

---

## Task 2: Rewrite `war-content.tsx`

**Files:**
- Modify: `front/app/game/war/_components/war-content.tsx`

The current file imports `useCurrentWar` from the defense page — replace the entire file with the version below.

- [ ] **Step 1: Replace `war-content.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { type War, type WarPlacement, getCurrentWar, createWar, endWar } from '@/app/services/war';
import { useWarActions } from '../_hooks/use-war-actions';
import { toast } from 'sonner';
import { WarMode } from './war-types';
import WarHeader from './war-header';
import WarDefendersTab from './war-defenders-tab';
import WarManagementBar from './war-management-bar';
import CreateWarDialog from './create-war-dialog';

const WarChampionSelector = dynamic(() => import('./war-champion-selector'), {
  loading: () => null,
});

const WarAttackerSelector = dynamic(() => import('./war-attacker-selector'), {
  loading: () => null,
});

export default function WarContent() {
  const { t } = useI18n();
  const { canManage } = useAllianceRole();

  useRequiredSession();

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
  } = useAllianceSelector();

  const [currentWar, setCurrentWar] = useState<War | null>(null);
  const [managementLoading, setManagementLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [warMode, setWarMode] = useState<WarMode>(WarMode.Defenders);

  // ─── Auto-select first alliance ──────────────────────────
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId, setSelectedAllianceId]);

  // ─── Fetch current war when alliance changes ──────────────
  const fetchCurrentWar = useCallback(async () => {
    if (!selectedAllianceId) return;
    setManagementLoading(true);
    try {
      const war = await getCurrentWar(selectedAllianceId);
      setCurrentWar(war);
    } catch (err: any) {
      if (err.status === 404) {
        setCurrentWar(null);
      } else {
        toast.error(t.game.war.loadError);
      }
    } finally {
      setManagementLoading(false);
    }
  }, [selectedAllianceId, t.game.war.loadError]);

  useEffect(() => {
    setCurrentWar(null);
    fetchCurrentWar();
  }, [selectedAllianceId, fetchCurrentWar]);

  const activeWarId = currentWar?.id ?? '';

  const {
    warSummary,
    warLoading,
    selectorNode,
    setSelectorNode,
    attackerSelectorNode,
    setAttackerSelectorNode,
    showClearConfirm,
    setShowClearConfirm,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearBg,
    handleAssignAttacker,
    handleRemoveAttacker,
    handleUpdateKo,
  } = useWarActions(selectedAllianceId, selectedBg, activeWarId);

  // ─── Actions ─────────────────────────────────────────────

  const placements: WarPlacement[] = warSummary?.placements ?? [];

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const canManageWar = selectedAlliance ? canManage(selectedAlliance) : false;

  const handleNodeClick = (nodeNumber: number) => {
    if (!activeWarId) return;
    if (warMode === WarMode.Attackers) {
      const hasDefender = placements.some((p) => p.node_number === nodeNumber);
      if (!hasDefender) {
        toast.warning(t.game.war.defenderRequired);
        return;
      }
      setAttackerSelectorNode(nodeNumber);
    } else {
      if (!selectedAlliance || !canManage(selectedAlliance)) return;
      setSelectorNode(nodeNumber);
    }
  };

  const handleCreateWar = async (opponentName: string) => {
    try {
      const war = await createWar(selectedAllianceId, opponentName);
      toast.success(t.game.war.createSuccess.replace('{name}', opponentName));
      setCurrentWar(war);
    } catch (err: any) {
      toast.error(err.message || t.game.war.createError);
      throw err;
    }
  };

  const handleEndWar = async () => {
    if (!currentWar) return;
    try {
      await endWar(selectedAllianceId, currentWar.id);
      toast.success(t.game.war.endWarSuccess);
      setCurrentWar(null);
    } catch (err: any) {
      toast.error(err.message || t.game.war.endWarError);
    }
  };

  // ─── Render ──────────────────────────────────────────────

  if (loading) return <FullPageSpinner />;

  return (
    <div className='w-full px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
      {alliances.length === 0 ? (
        <p className='text-muted-foreground'>{t.game.war.noAlliance}</p>
      ) : (
        <>
          <WarHeader
            alliances={alliances}
            selectedAllianceId={selectedAllianceId}
            onAllianceChange={setSelectedAllianceId}
          />

          {/* ── Management bar (officers/owners only) ──── */}
          {canManageWar && (
            <WarManagementBar
              activeWar={currentWar}
              loading={managementLoading}
              onClickDeclare={() => setShowCreateDialog(true)}
              onClickEndWar={() => setShowEndConfirm(true)}
            />
          )}

          {/* ── War map ──────────────────────────────────── */}
          {!activeWarId ? (
            <p className='text-muted-foreground'>{t.game.war.noActiveWar}</p>
          ) : (
            <WarDefendersTab
              activeWar={currentWar ?? undefined}
              selectedBg={selectedBg}
              onBgChange={setSelectedBg}
              canManageWar={canManageWar}
              warMode={warMode}
              onWarModeChange={setWarMode}
              warLoading={warLoading}
              placements={placements}
              onNodeClick={handleNodeClick}
              onRemoveDefender={handleRemoveDefender}
              onRemoveAttacker={handleRemoveAttacker}
              onUpdateKo={handleUpdateKo}
              onOpenClearConfirm={() => setShowClearConfirm(true)}
            />
          )}
        </>
      )}

      {/* Declare war dialog */}
      <CreateWarDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreateWar}
      />

      {/* End war confirm */}
      <ConfirmationDialog
        open={showEndConfirm}
        onOpenChange={setShowEndConfirm}
        onConfirm={async () => {
          setShowEndConfirm(false);
          await handleEndWar();
        }}
        title={t.game.war.endWarConfirmTitle}
        description={t.game.war.endWarConfirmDesc}
        variant='destructive'
      />

      {/* Defender champion selector */}
      <WarChampionSelector
        open={selectorNode !== null}
        onClose={() => setSelectorNode(null)}
        nodeNumber={selectorNode ?? 0}
        placedChampionIds={new Set(placements.map((p) => p.champion_id))}
        onSelect={handlePlaceDefender}
      />

      {/* Attacker selector */}
      <WarAttackerSelector
        open={attackerSelectorNode !== null}
        onClose={() => setAttackerSelectorNode(null)}
        nodeNumber={attackerSelectorNode ?? 0}
        allianceId={selectedAllianceId}
        warId={activeWarId}
        battlegroup={selectedBg}
        placements={placements}
        onSelect={handleAssignAttacker}
      />

      {/* Clear confirm dialog */}
      <ConfirmationDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        onConfirm={async () => {
          setShowClearConfirm(false);
          await handleClearBg();
        }}
        title={t.game.war.clearConfirmTitle}
        description={t.game.war.clearConfirmDesc}
        variant='destructive'
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd front && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add front/app/game/war/_components/war-content.tsx
git commit -m "feat: inline war state in war-content, add management bar"
```

---

## Task 3: Update `basic.cy.ts`

**Files:**
- Modify: `front/cypress/e2e/war/basic.cy.ts`

Changes (apply one block at a time with Edit tool):

- [ ] **Step 1: Rename + update "shows management tab for officer/owner"**

Find:
```ts
  it('shows management tab for officer/owner', () => {
    setupWarOwner('war-basic-tabs', 'TabPlayer', 'TabAlliance', 'TA').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.getByCy('tab-war-management').should('be.visible');
      cy.getByCy('tab-war-defenders').should('be.visible');
    });
  });
```

Replace with:
```ts
  it('shows declare war button for officer/owner', () => {
    setupWarOwner('war-basic-tabs', 'TabPlayer', 'TabAlliance', 'TA').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.getByCy('declare-war-btn').should('be.visible');
    });
  });
```

- [ ] **Step 2: Rename + update "shows only defenders tab for non-officer members"**

Find:
```ts
  it('shows only defenders tab for non-officer members', () => {
    setupWarOwner('war-basic-member', 'MemberPlayer', 'MemberAlliance', 'MB').then(
      ({ adminData, ownerData, allianceId }) => {
        // Create a member account
        setupUser('war-basic-member-member').then((memberData) => {
          cy.apiCreateGameAccount(memberData.access_token, 'RegularMember', true).then((acc) => {
            cy.apiForceJoinAlliance(acc.id, allianceId).then(() => {
              cy.uiLogin(memberData.login);
              cy.navTo('war');
              cy.getByCy('tab-war-management').should('not.exist');
              cy.getByCy('tab-war-defenders').should('be.visible');
            });
          });
        });
      }
    );
  });
```

Replace with:
```ts
  it('shows no declare war button for non-officer members', () => {
    setupWarOwner('war-basic-member', 'MemberPlayer', 'MemberAlliance', 'MB').then(
      ({ adminData, ownerData, allianceId }) => {
        setupUser('war-basic-member-member').then((memberData) => {
          cy.apiCreateGameAccount(memberData.access_token, 'RegularMember', true).then((acc) => {
            cy.apiForceJoinAlliance(acc.id, allianceId).then(() => {
              cy.uiLogin(memberData.login);
              cy.navTo('war');
              cy.getByCy('declare-war-btn').should('not.exist');
            });
          });
        });
      }
    );
  });
```

- [ ] **Step 3: Rename + update "shows war in selector after creation"**

Find:
```ts
  it('shows war in selector after creation', () => {
    setupWarOwner('war-basic-sel', 'SelPlayer', 'SelAlliance', 'SL').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy Alliance').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');
          cy.getByCy('war-select').should('contain', 'Enemy Alliance');
        });
      }
    );
  });
```

Replace with:
```ts
  it('shows war opponent after creation', () => {
    setupWarOwner('war-basic-sel', 'SelPlayer', 'SelAlliance', 'SL').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy Alliance').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');
          cy.getByCy('war-opponent-name').should('contain', 'Enemy Alliance');
        });
      }
    );
  });
```

- [ ] **Step 4: Remove tab click from "shows 50 war-map nodes"**

Find:
```ts
          // War is auto-selected (only one war) — switch directly to defenders tab
          cy.getByCy('tab-war-defenders').click();

          for (let i = 1; i <= 50; i++) {
```

Replace with:
```ts
          for (let i = 1; i <= 50; i++) {
```

- [ ] **Step 5: Remove tab click from "shows G1/G2/G3 battlegroup buttons"**

Find:
```ts
          // War is auto-selected (only one war) — switch directly to defenders tab
          cy.getByCy('tab-war-defenders').click();

          cy.getByCy('bg-btn-1').should('be.visible');
```

Replace with:
```ts
          cy.getByCy('bg-btn-1').should('be.visible');
```

- [ ] **Step 6: Update "shows declare war button in management tab for officer"**

Find:
```ts
  it('shows declare war button in management tab for officer', () => {
    setupWarOwner('war-basic-declare', 'DeclarePlayer', 'DeclareAlliance', 'DC').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        // Management tab is the default for officers
        cy.getByCy('declare-war-btn').should('be.visible');
      }
    );
  });
```

Replace with:
```ts
  it('shows declare war button for officer', () => {
    setupWarOwner('war-basic-declare', 'DeclarePlayer', 'DeclareAlliance', 'DC').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('declare-war-btn').should('be.visible');
      }
    );
  });
```

- [ ] **Step 7: Remove tab clicks from all 6 mode-toggle tests**

For each of these tests, find and remove the line `cy.getByCy('tab-war-defenders').click();` (along with its preceding comment `// War is auto-selected (only one war) — switch directly to defenders tab` if present):

Tests to update:
1. `shows mode toggle in defenders tab`
2. `defaults to defenders mode`
3. `switches to attackers mode on click`
4. `mode toggle is hidden for non-officer members`
5. `switches back to defenders mode from attackers`

Example for `shows mode toggle in defenders tab` — find:
```ts
          cy.getByCy('tab-war-defenders').click();

          cy.getByCy('war-mode-toggle').should('be.visible');
```
Replace with:
```ts
          cy.getByCy('war-mode-toggle').should('be.visible');
```

Apply the same pattern to each of the 5 tests above.

- [ ] **Step 8: Commit**

```bash
git add front/cypress/e2e/war/basic.cy.ts
git commit -m "test: update war basic tests — remove tabs, update selectors"
```

---

## Task 4: Update `operations.cy.ts`

**Files:**
- Modify: `front/cypress/e2e/war/operations.cy.ts`

- [ ] **Step 1: Replace `war-select` assertion in declare test**

Find:
```ts
        cy.contains('War declared against MightyFoes').should('be.visible');
        cy.getByCy('war-select').should('contain', 'MightyFoes');
```

Replace with:
```ts
        cy.contains('War declared against MightyFoes').should('be.visible');
        cy.getByCy('war-opponent-name').should('contain', 'MightyFoes');
```

- [ ] **Step 2: Remove all `tab-war-defenders` clicks (5 remaining tests)**

For each of these 5 tests, remove the line `cy.getByCy('tab-war-defenders').click();`:
- `officer can place a champion on a war node` (line ~37)
- `placed champion no longer appears in the selector list` (line ~62)
- `officer can remove a defender from the war map` (line ~94)
- `officer can clear all defenders in a battlegroup` (line ~118)
- `officer can switch between battlegroups with G1/G2/G3 buttons` (line ~142)

- [ ] **Step 3: Commit**

```bash
git add front/cypress/e2e/war/operations.cy.ts
git commit -m "test: update war operations tests — remove tab clicks, update war-select"
```

---

## Task 5: Update `war-attackers.cy.ts`

**Files:**
- Modify: `front/cypress/e2e/war/war-attackers.cy.ts`

- [ ] **Step 1: Remove all `tab-war-defenders` clicks (6 tests)**

Remove `cy.getByCy('tab-war-defenders').click();` from each of these tests:
1. `attackers panel is visible by default (Attackers mode)` — with its comment above
2. `assigned attacker appears in the attacker panel`
3. `member can increment and decrement KO count`
4. `member can remove an assigned attacker`
5. `member can assign attacker by clicking a node in Attackers mode`
6. `clicking node without defender shows warning toast`
7. `attacker panel shows x/3 counter per member`

- [ ] **Step 2: Commit**

```bash
git add front/cypress/e2e/war/war-attackers.cy.ts
git commit -m "test: update war-attackers tests — remove tab clicks"
```

---

## Task 6: Update `war-status.cy.ts`

**Files:**
- Modify: `front/cypress/e2e/war/war-status.cy.ts`

- [ ] **Step 1: Replace entire file**

```ts
import { setupWarOwner } from '../../support/e2e';

describe('War – Ended war status', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows no-war message after war ends', () => {
    setupWarOwner('war-status-ended', 'StatusOfficer', 'StatusAlliance', 'ST').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'StatusEnemy').then((war) => {
          cy.apiEndWar(ownerData.access_token, allianceId, war.id);

          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // After ending, getCurrentWar returns 404 → currentWar = null
          cy.contains('No war declared').should('be.visible');
          cy.getByCy('war-node-1').should('not.exist');
        });
      }
    );
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add front/cypress/e2e/war/war-status.cy.ts
git commit -m "test: update war-status test — ended war shows no-war message"
```

---

## Task 7: Update `attackers.cy.ts` comment

**Files:**
- Modify: `front/cypress/e2e/war/attackers.cy.ts`

- [ ] **Step 1: Update implementation instructions comment**

Find:
```ts
 * 4) Open `/game/war`, select active war, switch to Defenders tab if needed, then switch to Attackers mode.
```

Replace with:
```ts
 * 4) Open `/game/war` — the war map is visible directly. Switch to Attackers mode via the mode toggle (canManage only).
```

- [ ] **Step 2: Commit**

```bash
git add front/cypress/e2e/war/attackers.cy.ts
git commit -m "docs: update attackers.cy.ts instructions — no tabs"
```

---

## Task 8: Add end-war E2E test

**Files:**
- Create: `front/cypress/e2e/war/war-management.cy.ts`

- [ ] **Step 1: Create the test file**

```ts
import { setupWarOwner } from '../../support/e2e';

describe('War – Management (declare and end)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer can end a war via the end war button', () => {
    setupWarOwner('war-mgmt-end', 'EndWarOfficer', 'EndWarAlliance', 'EW').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'TargetEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // Active war shows opponent name and end-war button
          cy.getByCy('war-opponent-name').should('contain', 'TargetEnemy');
          cy.getByCy('end-war-btn').should('be.visible').click();

          // Confirm dialog
          cy.getByCy('confirmation-dialog-confirm').click();

          // After ending: declare button visible, map gone
          cy.getByCy('declare-war-btn').should('be.visible');
          cy.getByCy('war-node-1').should('not.exist');
        });
      }
    );
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add front/cypress/e2e/war/war-management.cy.ts
git commit -m "test: add end-war E2E test"
```

---

## Task 9: Run all war tests

- [ ] **Step 1: Run all war specs**

Use `mcp__cypress-runner__run_failing_tests` with:
```json
["cypress/e2e/war/basic.cy.ts", "cypress/e2e/war/operations.cy.ts", "cypress/e2e/war/war-attackers.cy.ts", "cypress/e2e/war/war-status.cy.ts", "cypress/e2e/war/war-management.cy.ts"]
```

Expected: all pass (0 failures)

- [ ] **Step 2: If any failures — investigate and fix**

Read the error, locate the assertion, fix the selector or test flow. Re-run failing specs only.

- [ ] **Step 3: Run full suite to check for regressions**

Use `mcp__server-runner__run_e2e` (runs all specs).

Expected: no regressions in non-war tests.
