# War Controls on Defense Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move "Declare War" and "End War" actions from the management tab to the defense page, remove the management tab entirely, and expose a new backend endpoint `GET /alliances/{id}/wars/current`.

**Architecture:** A new `GET /wars/current` endpoint returns the active war or 404. A shared `useCurrentWar` hook fetches it and owns create/end handlers. A `WarBanner` component renders on the defense page (officers only). `useWarActions` is simplified to accept `activeWarId` as a parameter instead of owning war list state.

**Tech Stack:** FastAPI + SQLModel (Python), Next.js App Router + React 19 + Tailwind CSS 4, Cypress E2E, pytest integration tests.

**Spec:** `docs/superpowers/specs/2026-03-22-war-controls-on-defense-page-design.md`

---

## File Map

| Action | File |
|--------|------|
| Modify | `api/src/services/WarService.py` |
| Modify | `api/src/controllers/war_controller.py` |
| Modify | `api/tests/integration/endpoints/war_test.py` |
| Modify | `front/app/services/war.ts` |
| Create | `front/app/game/defense/_hooks/use-current-war.ts` |
| Create | `front/app/game/defense/_components/war-banner.tsx` |
| Modify | `front/app/game/defense/_components/defense-content.tsx` |
| Modify | `front/app/game/war/_hooks/use-war-actions.ts` |
| Modify | `front/app/game/war/_components/war-content.tsx` |
| Edit   | `front/app/game/war/_components/war-types.ts` |
| Delete | `front/app/game/war/_components/war-management-tab.tsx` |
| Delete | `front/cypress/e2e/war/management.cy.ts` |
| Create | `front/cypress/e2e/defense/war-controls.cy.ts` |

---

## Task 1: Backend — `get_current_war` service method + endpoint

**Files:**
- Modify: `api/src/services/WarService.py`
- Modify: `api/src/controllers/war_controller.py`
- Test: `api/tests/integration/endpoints/war_test.py`

- [ ] **Step 1: Write failing tests**

Add this class at the end of `api/tests/integration/endpoints/war_test.py`:

```python
class TestGetCurrentWar:
    """GET /alliances/{alliance_id}/wars/current"""

    async def test_returns_active_war(self, client):
        data = await _setup_war()
        owner = data["owner"]
        alliance = data["alliance"]
        war = data["war"]

        response = await execute_get_request(
            client,
            f"/alliances/{alliance.id}/wars/current",
            headers=create_auth_headers(USER_ID),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == str(war.id)
        assert body["status"] == "active"
        assert body["opponent_name"] == OPPONENT

    async def test_returns_404_when_no_active_war(self, client):
        data = await _setup_alliance()
        alliance = data["alliance"]

        response = await execute_get_request(
            client,
            f"/alliances/{alliance.id}/wars/current",
            headers=create_auth_headers(USER_ID),
        )
        assert response.status_code == 404

    async def test_returns_404_after_war_ended(self, client):
        data = await _setup_war()
        owner = data["owner"]
        alliance = data["alliance"]
        war = data["war"]

        # End the war first
        await execute_post_request(
            client,
            f"/alliances/{alliance.id}/wars/{war.id}/end",
            headers=create_auth_headers(USER_ID),
        )

        response = await execute_get_request(
            client,
            f"/alliances/{alliance.id}/wars/current",
            headers=create_auth_headers(USER_ID),
        )
        assert response.status_code == 404

    async def test_returns_403_for_non_member(self, client):
        data = await _setup_war()
        alliance = data["alliance"]

        # USER3_ID is not a member of this alliance
        response = await execute_get_request(
            client,
            f"/alliances/{alliance.id}/wars/current",
            headers=create_auth_headers(USER3_ID),
        )
        assert response.status_code == 403
```

Note: `USER3_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")` is already defined at the top of the file. `_setup_war` already returns `data["war"]` — check the helper to confirm (look for `war = War(...)` followed by `load_objects`).

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd api && uv run pytest tests/integration/endpoints/war_test.py::TestGetCurrentWar -v
```

Expected: FAIL (endpoint does not exist yet).

- [ ] **Step 3: Add `get_current_war` to `WarService`**

In `api/src/services/WarService.py`, add after `get_wars`:

```python
@classmethod
async def get_current_war(
    cls,
    session: SessionDep,
    alliance_id: uuid.UUID,
) -> WarResponse:
    result = await session.exec(
        select(War).where(War.alliance_id == alliance_id, War.status == "active")
    )
    war = result.first()
    if war is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active war for this alliance",
        )
    return WarResponse.model_validate(await cls._load_war(session, war.id))
```

Make sure `HTTPException` and `status` are already imported (they are).

- [ ] **Step 4: Add endpoint to `war_controller.py`**

In `api/src/controllers/war_controller.py`, add after `list_wars`:

```python
@war_controller.get(
    "/current",
    response_model=WarResponse,
)
async def get_current_war(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the currently active war for an alliance. All members can view."""
    await _get_user_account_in_alliance(session, current_user, alliance_id)
    return await WarService.get_current_war(session, alliance_id)
```

⚠️ This route MUST be declared before any route with `/{war_id}` path segment to avoid FastAPI treating `"current"` as a war UUID. It is placed after `list_wars` (GET `""`) and before `get_war_defense` (GET `/{war_id}/bg/{battlegroup}`).

- [ ] **Step 5: Run tests**

```bash
cd api && uv run pytest tests/integration/endpoints/war_test.py::TestGetCurrentWar -v
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Run full war test suite**

```bash
cd api && uv run pytest tests/integration/endpoints/war_test.py -v
```

Expected: All tests PASS (no regressions).

- [ ] **Step 7: Commit**

```bash
git add api/src/services/WarService.py api/src/controllers/war_controller.py api/tests/integration/endpoints/war_test.py
git commit -m "feat: add GET /alliances/{id}/wars/current endpoint"
```

---

## Task 2: Frontend service — `getCurrentWar()`

**Files:**
- Modify: `front/app/services/war.ts`

- [ ] **Step 1: Add the function**

In `front/app/services/war.ts`, add after `getWars`:

```typescript
export async function getCurrentWar(allianceId: string): Promise<War> {
  const response = await fetch(`${PROXY}/alliances/${allianceId}/wars/current`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load current war');
  return response.json();
}
```

Note: returns `War` directly (not `War | null`) — callers catch the 404 and treat it as null.

- [ ] **Step 2: Commit**

```bash
git add front/app/services/war.ts
git commit -m "feat: add getCurrentWar service function"
```

---

## Task 3: Frontend hook — `useCurrentWar`

**Files:**
- Create: `front/app/game/defense/_hooks/use-current-war.ts`

- [ ] **Step 1: Create the hook**

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import { type War, getCurrentWar, createWar, endWar } from '@/app/services/war';

export function useCurrentWar(allianceId: string) {
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const [currentWar, setCurrentWar] = useState<War | null>(null);
  const [warLoading, setWarLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const fetchCurrentWar = useCallback(async (id: string) => {
    if (!id) return;
    setWarLoading(true);
    try {
      const war = await getCurrentWar(id);
      setCurrentWar(war);
    } catch (err: any) {
      if (err.status === 404) {
        setCurrentWar(null);
      } else {
        toast.error(tRef.current.game.war.loadError);
      }
    } finally {
      setWarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allianceId) fetchCurrentWar(allianceId);
  }, [allianceId, fetchCurrentWar]);

  const handleCreateWar = async (opponentName: string) => {
    if (!allianceId) return;
    try {
      const war = await createWar(allianceId, opponentName);
      toast.success(tRef.current.game.war.createSuccess.replace('{name}', opponentName));
      setCurrentWar(war);
    } catch (err: any) {
      toast.error(err.message || tRef.current.game.war.createError);
      throw err;
    }
  };

  const handleEndWar = async () => {
    if (!allianceId || !currentWar) return;
    try {
      await endWar(allianceId, currentWar.id);
      toast.success(tRef.current.game.war.endWarSuccess);
      setCurrentWar(null);
    } catch (err: any) {
      toast.error(err.message || tRef.current.game.war.endWarError);
    }
  };

  return {
    currentWar,
    warLoading,
    showCreateDialog,
    setShowCreateDialog,
    showEndConfirm,
    setShowEndConfirm,
    handleCreateWar,
    handleEndWar,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add front/app/game/defense/_hooks/use-current-war.ts
git commit -m "feat: add useCurrentWar hook"
```

---

## Task 4: Frontend component — `WarBanner`

**Files:**
- Create: `front/app/game/defense/_components/war-banner.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Swords, Flag } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { War } from '@/app/services/war';

interface WarBannerProps {
  currentWar: War | null;
  warLoading: boolean;
  onOpenCreateDialog: () => void;
  onOpenEndConfirm: () => void;
}

export default function WarBanner({
  currentWar,
  warLoading,
  onOpenCreateDialog,
  onOpenEndConfirm,
}: Readonly<WarBannerProps>) {
  const { t } = useI18n();

  if (warLoading) return null;

  return (
    <div className='flex items-center gap-3' data-cy='war-banner'>
      {currentWar ? (
        <>
          <div className='flex items-center gap-1.5 text-sm'>
            <Swords className='w-4 h-4 text-muted-foreground' />
            <span className='text-muted-foreground'>vs</span>
            <span className='font-semibold' data-cy='current-war-opponent'>
              {currentWar.opponent_name}
            </span>
          </div>
          <Button
            variant='destructive'
            size='sm'
            onClick={onOpenEndConfirm}
            data-cy='end-war-btn'
          >
            <Flag className='w-4 h-4 mr-1' />
            {t.game.war.endWar}
          </Button>
        </>
      ) : (
        <>
          <span className='text-sm text-muted-foreground'>{t.game.war.noActiveWar}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='default'
                  size='sm'
                  onClick={onOpenCreateDialog}
                  data-cy='declare-war-btn'
                >
                  <Swords className='w-4 h-4 mr-1' />
                  {t.game.war.declareWar}
                </Button>
              </TooltipTrigger>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add front/app/game/defense/_components/war-banner.tsx
git commit -m "feat: add WarBanner component"
```

---

## Task 5: Integrate `WarBanner` into `DefenseContent`

**Files:**
- Modify: `front/app/game/defense/_components/defense-content.tsx`

- [ ] **Step 1: Add imports at top of file**

Add these imports after the existing import block:

```typescript
import dynamic from 'next/dynamic';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { useCurrentWar } from '../_hooks/use-current-war';

const WarBanner = dynamic(() => import('./war-banner'), { loading: () => null });
const CreateWarDialog = dynamic(
  () => import('../../war/_components/create-war-dialog'),
  { loading: () => null }
);
```

- [ ] **Step 2: Add hook call inside the component**

After the `useDefenseActions(...)` call, add:

```typescript
const {
  currentWar,
  warLoading,
  showCreateDialog,
  setShowCreateDialog,
  showEndConfirm,
  setShowEndConfirm,
  handleCreateWar,
  handleEndWar,
} = useCurrentWar(selectedAllianceId);
```

- [ ] **Step 3: Add WarBanner and dialogs to JSX**

In the return block, inside `<div className='space-y-4'>`, add between `<DefenseHeader>` and `<DefenseGrid>`:

```tsx
{userCanManage && (
  <WarBanner
    currentWar={currentWar}
    warLoading={warLoading}
    onOpenCreateDialog={() => setShowCreateDialog(true)}
    onOpenEndConfirm={() => setShowEndConfirm(true)}
  />
)}
```

After the closing `<DefenseGrid>` and before the final `</div>`, add the dialogs:

```tsx
<CreateWarDialog
  open={showCreateDialog}
  onClose={() => setShowCreateDialog(false)}
  onConfirm={handleCreateWar}
/>

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
```

- [ ] **Step 4: Check it builds**

```bash
cd front && npm run build 2>&1 | tail -20
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add front/app/game/defense/_components/defense-content.tsx
git commit -m "feat: integrate WarBanner and war dialogs into defense page"
```

---

## Task 6: Refactor `useWarActions` — remove management state, accept `activeWarId`

**Files:**
- Modify: `front/app/game/war/_hooks/use-war-actions.ts`

- [ ] **Step 1: Rewrite the hook**

Replace the entire file content with:

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type WarDefenseSummary,
  type AvailableAttacker,
  getWarDefense,
  placeWarDefender,
  removeWarDefender,
  clearWarBg,
  assignWarAttacker,
  removeWarAttacker,
  updateWarKo,
} from '@/app/services/war';

export function useWarActions(
  selectedAllianceId: string,
  selectedBg: number,
  activeWarId: string,
) {
  const { t } = useI18n();

  const [warSummary, setWarSummary] = useState<WarDefenseSummary | null>(null);
  const [warLoading, setWarLoading] = useState(false);
  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [attackerSelectorNode, setAttackerSelectorNode] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  // ─── Fetch war defense ───────────────────────────────────
  const fetchWarDefense = useCallback(
    async (silent = false) => {
      if (!selectedAllianceId || !activeWarId) return;
      if (!silent) setWarLoading(true);
      try {
        const summary = await getWarDefense(selectedAllianceId, activeWarId, selectedBg);
        setWarSummary(summary);
      } catch {
        if (!silent) toast.error(tRef.current.game.war.loadError);
      } finally {
        if (!silent) setWarLoading(false);
      }
    },
    [selectedAllianceId, activeWarId, selectedBg]
  );

  useEffect(() => {
    setWarSummary(null);
    if (activeWarId) {
      fetchWarDefense();
    }
  }, [activeWarId, selectedBg, fetchWarDefense]);

  // Polling every 10s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeWarId) {
      pollRef.current = setInterval(() => fetchWarDefense(true), 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchWarDefense, activeWarId]);

  // ─── Actions ─────────────────────────────────────────────

  const handlePlaceDefender = async (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => {
    if (!selectedAllianceId || !activeWarId || selectorNode === null) return;
    try {
      await placeWarDefender(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        selectorNode,
        championId,
        stars,
        rank,
        ascension
      );
      toast.success(
        t.game.war.placeSuccess
          .replace('{name}', championName)
          .replace('{node}', String(selectorNode))
      );
      await fetchWarDefense();
    } catch (err: any) {
      toast.error(err.message || t.game.war.placeError);
    }
  };

  const handleRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await removeWarDefender(selectedAllianceId, activeWarId, selectedBg, nodeNumber);
      toast.success(t.game.war.removeSuccess);
      await fetchWarDefense();
    } catch (err: any) {
      toast.error(err.message || t.game.war.removeError);
    }
  };

  const handleClearBg = async () => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await clearWarBg(selectedAllianceId, activeWarId, selectedBg);
      toast.success(t.game.war.clearSuccess);
      await fetchWarDefense();
    } catch {
      toast.error(t.game.war.loadError);
    }
  };

  const handleAssignAttacker = async (attacker: AvailableAttacker) => {
    if (!selectedAllianceId || !activeWarId || attackerSelectorNode === null) return;
    const nodeNumber = attackerSelectorNode;
    try {
      await assignWarAttacker(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        nodeNumber,
        attacker.champion_user_id
      );
      toast.success(
        t.game.war.assignSuccess
          .replace('{name}', attacker.champion_name)
          .replace('{node}', String(nodeNumber))
      );
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === nodeNumber
                  ? {
                      ...p,
                      attacker_champion_user_id: attacker.champion_user_id,
                      attacker_pseudo: attacker.game_pseudo,
                      attacker_champion_name: attacker.champion_name,
                      attacker_champion_class: attacker.champion_class,
                      attacker_image_url: attacker.image_url,
                      attacker_rarity: attacker.rarity,
                    }
                  : p
              ),
            }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || t.game.war.assignError);
    }
  };

  const handleRemoveAttacker = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const updated = await removeWarAttacker(selectedAllianceId, activeWarId, selectedBg, nodeNumber);
      toast.success(t.game.war.removeAttackerSuccess);
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || t.game.war.removeAttackerError);
    }
  };

  const handleUpdateKo = async (nodeNumber: number, newKo: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const updated = await updateWarKo(selectedAllianceId, activeWarId, selectedBg, nodeNumber, newKo);
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || t.game.war.koUpdateError);
    }
  };

  return {
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
  };
}
```

- [ ] **Step 2: Build check**

```bash
cd front && npm run build 2>&1 | tail -30
```

Expected: TypeScript errors pointing to `war-content.tsx` using the old hook signature. These will be fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add front/app/game/war/_hooks/use-war-actions.ts
git commit -m "refactor: remove war list state from useWarActions, accept activeWarId param"
```

---

## Task 7: Update `war-content.tsx`, `war-types.ts`, delete `war-management-tab.tsx`

**Files:**
- Modify: `front/app/game/war/_components/war-content.tsx`
- Edit: `front/app/game/war/_components/war-types.ts`
- Delete: `front/app/game/war/_components/war-management-tab.tsx`

- [ ] **Step 1: Edit `war-types.ts` — remove `WarTab.Management`**

Replace the entire file:

```typescript
export enum WarMode {
  Defenders = 'defenders',
  Attackers = 'attackers',
}
```

- [ ] **Step 2: Rewrite `war-content.tsx`**

Replace the entire file:

```typescript
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useI18n } from '@/app/i18n';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import TabBar, { type TabItem } from '@/components/tab-bar';
import { type WarPlacement } from '@/app/services/war';
import { useWarActions } from '../_hooks/use-war-actions';
import { useCurrentWar } from '../../defense/_hooks/use-current-war';
import { toast } from 'sonner';
import { WarMode } from './war-types';
import WarHeader from './war-header';
import WarDefendersTab from './war-defenders-tab';

const WarChampionSelector = dynamic(() => import('./war-champion-selector'), {
  loading: () => null,
});

const WarAttackerSelector = dynamic(() => import('./war-attacker-selector'), {
  loading: () => null,
});

export default function WarContent() {
  const { t } = useI18n();
  const { canManage, loading: roleLoading } = useAllianceRole();

  useRequiredSession();

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
  } = useAllianceSelector();

  const { currentWar } = useCurrentWar(selectedAllianceId);
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

  const [warMode, setWarMode] = useState<WarMode>(WarMode.Defenders);

  // ─── Auto-select first alliance ──────────────────────────
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId, setSelectedAllianceId]);

  // ─── Actions ─────────────────────────────────────────────

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
      const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
      if (!selectedAlliance || !canManage(selectedAlliance)) return;
      setSelectorNode(nodeNumber);
    }
  };

  // ─── Render ──────────────────────────────────────────────

  if (loading) return <FullPageSpinner />;

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const canManageWar = selectedAlliance ? canManage(selectedAlliance) : false;
  const placements: WarPlacement[] = warSummary?.placements ?? [];
  const activeWar = currentWar;

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

          {/* ── Defenders tab ────────────────────────────── */}
          {!activeWarId ? (
            <p className='text-muted-foreground'>{t.game.war.noActiveWar}</p>
          ) : (
            <WarDefendersTab
              activeWar={activeWar}
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

- [ ] **Step 3: Delete `war-management-tab.tsx`**

```bash
rm front/app/game/war/_components/war-management-tab.tsx
```

- [ ] **Step 4: Build check**

```bash
cd front && npm run build 2>&1 | tail -30
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add front/app/game/war/_components/war-content.tsx front/app/game/war/_components/war-types.ts
git rm front/app/game/war/_components/war-management-tab.tsx
git commit -m "refactor: remove war management tab, war page uses useCurrentWar for activeWarId"
```

---

## Task 8: Delete obsolete E2E test file

**Files:**
- Delete: `front/cypress/e2e/war/management.cy.ts`

- [ ] **Step 1: Delete the file**

```bash
git rm front/cypress/e2e/war/management.cy.ts
git commit -m "test: remove obsolete war management E2E tests"
```

---

## Task 9: Add new E2E tests for war controls on defense page

**Files:**
- Create: `front/cypress/e2e/defense/war-controls.cy.ts`

- [ ] **Step 1: Create the directory and test file**

```bash
mkdir -p front/cypress/e2e/defense
```

Write `front/cypress/e2e/defense/war-controls.cy.ts`:

```typescript
import { setupDefenseOwner, setupUser, BACKEND } from '../../support/e2e';

describe('War Controls on Defense Page', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function setupWarScenario(prefix: string) {
    return setupDefenseOwner(
      prefix,
      `${prefix}Owner`,
      `${prefix}Alliance`,
      prefix.slice(0, 3).toUpperCase()
    );
  }

  // ── No active war ─────────────────────────────────────────────────────────

  it('officer sees WarBanner with Declare War when no active war', () => {
    setupWarScenario('wc-nodeclare').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('defense');

      cy.getByCy('war-banner').should('be.visible');
      cy.getByCy('declare-war-btn').should('be.visible');
      cy.getByCy('end-war-btn').should('not.exist');
    });
  });

  // ── Declare war ───────────────────────────────────────────────────────────

  it('officer can declare a war from the defense page', () => {
    setupWarScenario('wc-declare').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('defense');

      cy.getByCy('declare-war-btn').click();
      cy.getByCy('create-war-opponent-input').type('Enemy Alliance');
      cy.getByCy('create-war-confirm-btn').click();

      cy.getByCy('current-war-opponent').should('have.text', 'Enemy Alliance');
      cy.getByCy('end-war-btn').should('be.visible');
      cy.getByCy('declare-war-btn').should('not.exist');
    });
  });

  // ── Active war ────────────────────────────────────────────────────────────

  it('officer sees End War button when active war exists', () => {
    setupWarScenario('wc-active').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'TestEnemy');

      cy.uiLogin(ownerData.login);
      cy.navTo('defense');

      cy.getByCy('war-banner').should('be.visible');
      cy.getByCy('end-war-btn').should('be.visible');
      cy.getByCy('current-war-opponent').should('have.text', 'TestEnemy');
      cy.getByCy('declare-war-btn').should('not.exist');
    });
  });

  // ── End war ───────────────────────────────────────────────────────────────

  it('officer can end the active war from the defense page', () => {
    setupWarScenario('wc-end').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'EndableEnemy');

      cy.uiLogin(ownerData.login);
      cy.navTo('defense');

      cy.getByCy('end-war-btn').click();
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy('declare-war-btn').should('be.visible');
      cy.getByCy('end-war-btn').should('not.exist');
    });
  });

  // ── Non-officer cannot see banner ─────────────────────────────────────────

  it('non-officer does not see WarBanner', () => {
    setupWarScenario('wc-nonoff').then(({ ownerData, allianceId }) => {
      // Create a plain member (not officer)
      cy.then(() => setupUser('wc-nonoff-member')).then((memberData) => {
        cy.apiCreateGameAccount(memberData.access_token, 'NonOfficer', true).then((acc) => {
          cy.apiForceJoinAlliance(acc.id, allianceId);

          cy.uiLogin(memberData.login);
          cy.navTo('defense');

          cy.getByCy('war-banner').should('not.exist');
        });
      });
    });
  });
});
```

Note: `cy.apiCreateWar`, `cy.apiForceJoinAlliance`, `cy.apiCreateGameAccount`, `setupUser`, `setupDefenseOwner` are all defined in `cypress/support/e2e.ts`. `create-war-opponent-input` and `create-war-confirm-btn` are `data-cy` attributes on `CreateWarDialog` — verify them before running (read `war-champion-selector.tsx` or `create-war-dialog.tsx`).

- [ ] **Step 2: Verify `data-cy` attributes on `CreateWarDialog`**

Read `front/app/game/war/_components/create-war-dialog.tsx` and confirm:
- The text input has `data-cy='create-war-opponent-input'`
- The confirm button has `data-cy='create-war-confirm-btn'`

Add them if missing.

- [ ] **Step 3: Run the new E2E tests**

```bash
# From project root, with test servers running:
SPEC=cypress/e2e/defense/war-controls.cy.ts make e2e
```

Or use `mcp__server-runner__run_e2e` with spec filter.

Expected: All 5 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add front/cypress/e2e/defense/war-controls.cy.ts
git commit -m "test: add E2E tests for war controls on defense page"
```

---

## Task 10: Run full test suites and verify

- [ ] **Step 1: Run all backend tests**

```bash
cd api && uv run pytest tests/ -v --tb=short
```

Expected: All tests PASS.

- [ ] **Step 2: Run all E2E tests**

Use `mcp__server-runner__run_e2e` (or `make e2e` from project root).

Expected: All tests PASS, including the new `war-controls.cy.ts` and all existing war/defense specs.

- [ ] **Step 3: Run ruff lint**

```bash
cd api && uvx ruff check
```

Expected: No errors.
