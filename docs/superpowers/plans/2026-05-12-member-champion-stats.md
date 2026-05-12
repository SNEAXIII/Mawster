# Member Champion Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the alliance statistics tab into a two-column layout where clicking a member row updates a pie chart showing their champion usage for the current season, with a war filter and detail modal.

**Architecture:** New backend endpoint `GET /statistics/champion-usage/{alliance_id}` aggregates `WarFightRecord` by `champion_id`. Frontend splits the stats tab into a table (left) + recharts `PieChart` (right), orchestrated by a new `useChampionStats` hook. Row clicks and war filter update the chart in real time.

**Tech Stack:** Python/FastAPI/SQLModel (backend), Next.js/React 19/Tailwind CSS 4/shadcn/ui/recharts (frontend)

---

## File Map

| File | Action |
|------|--------|
| `api/src/dto/dto_statistic.py` | Add `ChampionUsageResponse` |
| `api/src/services/StatisticService.py` | Add `get_champion_usage()` |
| `api/src/controllers/statistic_controller.py` | Add `GET /champion-usage/{alliance_id}` route |
| `api/tests/integration/endpoints/statistic_test.py` | Add `TestGetChampionUsage` class |
| `front/app/services/statistics.ts` | Add `ChampionUsageItem` type + `getChampionUsage()` |
| `front/app/i18n/locales/en.ts` | Add i18n keys under `statistics` |
| `front/app/i18n/locales/fr.ts` | Add i18n keys under `statistics` |
| `front/app/game/alliances/_components/member-champion-chart.tsx` | New: pie chart + metric toggle |
| `front/app/game/alliances/_components/champion-detail-modal.tsx` | New: full champion list modal |
| `front/app/game/alliances/_components/use-champion-stats.ts` | New: hook managing chart state + fetches |
| `front/app/game/alliances/_components/alliance-statistics-tab.tsx` | Redesign: 2-col layout, row click, war filter |

---

## Task 1: Backend DTO — ChampionUsageResponse

**Files:**
- Modify: `api/src/dto/dto_statistic.py`

- [ ] **Step 1: Add the DTO class**

Open `api/src/dto/dto_statistic.py` and add at the bottom:

```python
class ChampionUsageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    fight_count: int
    total_kos: int
```

- [ ] **Step 2: Commit**

```bash
git add api/src/dto/dto_statistic.py
git commit -m "feat(stats): add ChampionUsageResponse DTO"
```

---

## Task 2: Backend Service — get_champion_usage (TDD)

**Files:**
- Modify: `api/src/services/StatisticService.py`

- [ ] **Step 1: Write the failing integration test first**

Add this class to `api/tests/integration/endpoints/statistic_test.py` (below existing imports and helpers — add new imports as needed):

```python
# Add these imports at the top of the file
from src.models.WarFightRecord import WarFightRecord

CHAMPION_USAGE_URL = "/statistics/champion-usage"


async def _push_fight_record(
    war: War,
    alliance_id,
    game_account_id,
    champion,
    defender_champion,
    ko_count: int = 0,
) -> WarFightRecord:
    record = WarFightRecord(
        war_id=war.id,
        alliance_id=alliance_id,
        season_id=war.season_id,
        game_account_id=game_account_id,
        battlegroup=1,
        node_number=1,
        tier=7,
        champion_id=champion.id,
        stars=7,
        rank=3,
        ascension=0,
        is_saga_attacker=False,
        defender_champion_id=defender_champion.id,
        defender_stars=7,
        defender_rank=3,
        defender_ascension=0,
        defender_is_saga_defender=False,
        ko_count=ko_count,
    )
    await load_objects([record])
    return record


class TestGetChampionUsage:
    @pytest.mark.anyio
    async def test_returns_empty_when_no_records(self):
        data = await _base_setup()
        response = await execute_get_request(
            f"{CHAMPION_USAGE_URL}/{data['alliance'].id}", USER_HEADERS
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.anyio
    async def test_returns_aggregated_champion_usage(self):
        data = await _setup_with_active_season()
        defender = await push_champion(name="Wolverine", champion_class="Mutant")
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id,
            data["champ"], defender, ko_count=1,
        )
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id,
            data["champ"], defender, ko_count=0,
        )
        response = await execute_get_request(
            f"{CHAMPION_USAGE_URL}/{data['alliance'].id}", USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["champion_name"] == "Spider-Man"
        assert body[0]["fight_count"] == 2
        assert body[0]["total_kos"] == 1

    @pytest.mark.anyio
    async def test_filters_by_game_account_id(self):
        data = await _setup_with_active_season()
        other_champ = await push_champion(name="Iron Man", champion_class="Tech")
        defender = await push_champion(name="Wolverine", champion_class="Mutant")
        user2_acc = await push_user2()
        # Push a second game account in the same alliance for user2
        from src.models.GameAccount import GameAccount
        ga2 = GameAccount(
            user_id=user2_acc.id,
            game_pseudo="User2Acc",
            alliance_id=data["alliance"].id,
        )
        await load_objects([ga2])
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id,
            data["champ"], defender,
        )
        await _push_fight_record(
            data["war"], data["alliance"].id, ga2.id,
            other_champ, defender,
        )
        response = await execute_get_request(
            f"{CHAMPION_USAGE_URL}/{data['alliance'].id}?game_account_id={data['owner'].id}",
            USER_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["champion_name"] == "Spider-Man"

    @pytest.mark.anyio
    async def test_filters_by_war_id(self):
        data = await _setup_with_active_season()
        defender = await push_champion(name="Wolverine", champion_class="Mutant")
        other_champ = await push_champion(name="Iron Man", champion_class="Tech")
        war2 = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Enemy2",
            created_by_id=data["owner"].id,
            season_id=data["season"].id,
            status=WarStatus.ended,
        )
        await load_objects([war2])
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id, data["champ"], defender,
        )
        await _push_fight_record(
            war2, data["alliance"].id, data["owner"].id, other_champ, defender,
        )
        response = await execute_get_request(
            f"{CHAMPION_USAGE_URL}/{data['alliance'].id}?war_id={data['war'].id}",
            USER_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["champion_name"] == "Spider-Man"

    @pytest.mark.anyio
    async def test_stranger_gets_403(self):
        data = await _base_setup()
        await push_user2()
        response = await execute_get_request(
            f"{CHAMPION_USAGE_URL}/{data['alliance'].id}", USER2_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_visitor_can_access(self):
        data = await _setup_with_active_season()
        await push_user2()
        await push_visitor(data["alliance"], USER2_ID, game_pseudo="Visitor1")
        defender = await push_champion(name="Wolverine", champion_class="Mutant")
        await _push_fight_record(
            data["war"], data["alliance"].id, data["owner"].id, data["champ"], defender,
        )
        response = await execute_get_request(
            f"{CHAMPION_USAGE_URL}/{data['alliance'].id}", USER2_HEADERS
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd api && uv run pytest tests/integration/endpoints/statistic_test.py::TestGetChampionUsage -v
```

Expected: all 6 tests FAIL with errors (endpoint doesn't exist yet).

- [ ] **Step 3: Implement `get_champion_usage` in `StatisticService`**

Open `api/src/services/StatisticService.py`. Add these imports at the top:

```python
from typing import Optional
from src.dto.dto_statistic import ChampionUsageResponse
from src.models.Champion import Champion
from src.models.WarFightRecord import WarFightRecord
```

Then add the method to `StatisticService`:

```python
    @classmethod
    async def get_champion_usage(
        cls,
        session: SessionDep,
        current_user: User,
        alliance_id: uuid.UUID,
        game_account_id: Optional[uuid.UUID] = None,
        war_id: Optional[uuid.UUID] = None,
    ) -> list[ChampionUsageResponse]:
        alliance = await session.get(Alliance, alliance_id)
        if alliance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
        if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        conditions = [
            WarFightRecord.alliance_id == alliance_id,
            Season.is_active == True,  # noqa: E712
        ]
        if game_account_id is not None:
            conditions.append(WarFightRecord.game_account_id == game_account_id)
        if war_id is not None:
            conditions.append(WarFightRecord.war_id == war_id)

        stmt = (
            select(
                WarFightRecord.champion_id,
                Champion.name.label("champion_name"),
                cast(func.count(WarFightRecord.id), Integer).label("fight_count"),
                cast(func.sum(WarFightRecord.ko_count), Integer).label("total_kos"),
            )
            .join(Champion, Champion.id == WarFightRecord.champion_id)
            .join(Season, Season.id == WarFightRecord.season_id)
            .where(and_(*conditions))
            .group_by(WarFightRecord.champion_id, Champion.name)
            .order_by(func.count(WarFightRecord.id).desc())
        )
        rows = (await session.exec(stmt)).mappings().all()
        return [ChampionUsageResponse.model_validate(dict(row)) for row in rows]
```

- [ ] **Step 4: Run tests — must pass**

```bash
cd api && uv run pytest tests/integration/endpoints/statistic_test.py::TestGetChampionUsage -v
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/StatisticService.py api/src/dto/dto_statistic.py api/tests/integration/endpoints/statistic_test.py
git commit -m "feat(stats): add get_champion_usage service with integration tests"
```

---

## Task 3: Backend Route

**Files:**
- Modify: `api/src/controllers/statistic_controller.py`

- [ ] **Step 1: Add the route**

Open `api/src/controllers/statistic_controller.py`. Add `Optional` to imports and extend the file:

```python
from typing import Annotated, Optional

import uuid
from fastapi import APIRouter, Depends, Query

from src.dto.dto_statistic import PlayerSeasonStatsResponse, ChampionUsageResponse
from src.models import User
from src.utils.db import SessionDep
from src.services.StatisticService import StatisticService
from src.services.AuthService import AuthService

statistics_controller = APIRouter(
    prefix="/statistics",
    tags=["Statistics"],
    dependencies=[
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@statistics_controller.get(
    "/current_season/{alliance_id}",
    response_model=list[PlayerSeasonStatsResponse],
)
async def get_current_season_statistics(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    alliance_id: uuid.UUID,
):
    """Get the current season statistics."""
    return await StatisticService.get_active_season_statistics(session, current_user, alliance_id)


@statistics_controller.get(
    "/champion-usage/{alliance_id}",
    response_model=list[ChampionUsageResponse],
)
async def get_champion_usage(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    alliance_id: uuid.UUID,
    game_account_id: Optional[uuid.UUID] = Query(default=None),
    war_id: Optional[uuid.UUID] = Query(default=None),
):
    """Get champion usage aggregated for an alliance in the active season."""
    return await StatisticService.get_champion_usage(
        session, current_user, alliance_id, game_account_id, war_id
    )
```

- [ ] **Step 2: Run lint**

```bash
cd api && uvx ruff check src/controllers/statistic_controller.py src/services/StatisticService.py
```

Expected: no errors.

- [ ] **Step 3: Run all statistic tests**

```bash
cd api && uv run pytest tests/integration/endpoints/statistic_test.py -v
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add api/src/controllers/statistic_controller.py
git commit -m "feat(stats): add GET /statistics/champion-usage/{alliance_id} endpoint"
```

---

## Task 4: Frontend — Install recharts

**Files:**
- Modify: `front/package.json` (via npm)

- [ ] **Step 1: Install recharts**

```bash
cd front && npm install recharts
```

Expected: recharts added to `package.json` dependencies, no peer dep errors.

- [ ] **Step 2: Commit**

```bash
git add front/package.json front/package-lock.json
git commit -m "feat(stats): install recharts for pie chart"
```

---

## Task 5: Frontend Service — getChampionUsage

**Files:**
- Modify: `front/app/services/statistics.ts`

- [ ] **Step 1: Add type and function**

Open `front/app/services/statistics.ts`. Append at the bottom:

```typescript
export interface ChampionUsageItem {
  champion_id: string;
  champion_name: string;
  fight_count: number;
  total_kos: number;
}

export async function getChampionUsage(
  allianceId: string,
  gameAccountId?: string,
  warId?: string,
): Promise<ChampionUsageItem[]> {
  const params = new URLSearchParams();
  if (gameAccountId) params.set('game_account_id', gameAccountId);
  if (warId) params.set('war_id', warId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${PROXY}/statistics/champion-usage/${allianceId}${query}`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load champion usage');
  return response.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add front/app/services/statistics.ts
git commit -m "feat(stats): add getChampionUsage service function"
```

---

## Task 6: Frontend i18n — Add keys

**Files:**
- Modify: `front/app/i18n/locales/en.ts`
- Modify: `front/app/i18n/locales/fr.ts`

- [ ] **Step 1: Add keys to en.ts**

In `front/app/i18n/locales/en.ts`, find the `statistics:` block (around line 206). It ends with `columns: { ... }`. Add these keys after the `columns` block and before the closing `}` of `statistics`:

```typescript
        warFilter: 'War',
        allWars: 'All wars',
        chartByFights: 'Fights',
        chartByKos: 'KOs',
        seeDetail: 'See details',
        others: 'Others',
        allianceView: 'Whole alliance',
        loadingChart: 'Loading chart...',
```

- [ ] **Step 2: Add keys to fr.ts**

In `front/app/i18n/locales/fr.ts`, find the same `statistics:` block and add the same keys translated:

```typescript
        warFilter: 'Guerre',
        allWars: 'Toutes les guerres',
        chartByFights: 'Combats',
        chartByKos: 'KOs',
        seeDetail: 'Voir le détail',
        others: 'Autres',
        allianceView: 'Alliance entière',
        loadingChart: 'Chargement du graphique...',
```

- [ ] **Step 3: Verify TypeScript types compile**

```bash
cd front && npm run build 2>&1 | grep -i "error" | head -20
```

Expected: no type errors related to i18n keys.

- [ ] **Step 4: Commit**

```bash
git add front/app/i18n/locales/en.ts front/app/i18n/locales/fr.ts
git commit -m "feat(stats): add i18n keys for champion chart"
```

---

## Task 7: Frontend — useChampionStats hook

**Files:**
- Create: `front/app/game/alliances/_components/use-champion-stats.ts`

- [ ] **Step 1: Create the hook**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getChampionUsage, type ChampionUsageItem } from '@/app/services/statistics';
import { getWars, type War } from '@/app/services/war';

export function useChampionStats(allianceId: string) {
  const [selectedGameAccountId, setSelectedGameAccountId] = useState<string | null>(null);
  const [selectedWarId, setSelectedWarId] = useState<string | null>(null);
  const [championUsage, setChampionUsage] = useState<ChampionUsageItem[]>([]);
  const [chartMetric, setChartMetric] = useState<'fights' | 'kos'>('fights');
  const [detailOpen, setDetailOpen] = useState(false);
  const [wars, setWars] = useState<War[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    if (!allianceId) return;
    getWars(allianceId)
      .then((all) => setWars(all.filter((w) => w.season_id !== null && w.status === 'ended')))
      .catch(console.error);
  }, [allianceId]);

  useEffect(() => {
    if (!allianceId) return;
    setChartLoading(true);
    getChampionUsage(
      allianceId,
      selectedGameAccountId ?? undefined,
      selectedWarId ?? undefined,
    )
      .then(setChampionUsage)
      .catch(console.error)
      .finally(() => setChartLoading(false));
  }, [allianceId, selectedGameAccountId, selectedWarId]);

  const handleRowClick = (gameAccountId: string) => {
    setSelectedGameAccountId((prev) => (prev === gameAccountId ? null : gameAccountId));
  };

  return {
    selectedGameAccountId,
    selectedWarId,
    setSelectedWarId,
    championUsage,
    chartMetric,
    setChartMetric,
    detailOpen,
    setDetailOpen,
    wars,
    chartLoading,
    handleRowClick,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add front/app/game/alliances/_components/use-champion-stats.ts
git commit -m "feat(stats): add useChampionStats hook"
```

---

## Task 8: Frontend — MemberChampionChart component

**Files:**
- Create: `front/app/game/alliances/_components/member-champion-chart.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import type { ChampionUsageItem } from '@/app/services/statistics';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#94a3b8'];

interface MemberChampionChartProps {
  data: ChampionUsageItem[];
  metric: 'fights' | 'kos';
  onMetricChange: (m: 'fights' | 'kos') => void;
  onViewDetail: () => void;
  loading: boolean;
  playerName: string | null;
}

export function MemberChampionChart({
  data,
  metric,
  onMetricChange,
  onViewDetail,
  loading,
  playerName,
}: MemberChampionChartProps) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;

  const sorted = [...data].sort((a, b) =>
    metric === 'fights' ? b.fight_count - a.fight_count : b.total_kos - a.total_kos,
  );
  const top5 = sorted.slice(0, 5);
  const othersValue = sorted
    .slice(5)
    .reduce((sum, c) => sum + (metric === 'fights' ? c.fight_count : c.total_kos), 0);

  const chartData = [
    ...top5.map((c) => ({
      name: c.champion_name,
      value: metric === 'fights' ? c.fight_count : c.total_kos,
    })),
    ...(othersValue > 0 ? [{ name: stat.others, value: othersValue }] : []),
  ];

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-muted-foreground'>
          {playerName ?? stat.allianceView}
        </span>
        <div className='flex gap-1'>
          <Button
            size='sm'
            variant={metric === 'fights' ? 'default' : 'outline'}
            onClick={() => onMetricChange('fights')}
            data-cy='chart-metric-fights'
          >
            {stat.chartByFights}
          </Button>
          <Button
            size='sm'
            variant={metric === 'kos' ? 'default' : 'outline'}
            onClick={() => onMetricChange('kos')}
            data-cy='chart-metric-kos'
          >
            {stat.chartByKos}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className='text-sm text-muted-foreground text-center py-8'>{stat.loadingChart}</p>
      ) : chartData.length === 0 ? (
        <p className='text-sm text-muted-foreground text-center py-8'>{stat.empty}</p>
      ) : (
        <ResponsiveContainer width='100%' height={260}>
          <PieChart>
            <Pie data={chartData} dataKey='value' nameKey='name' cx='50%' cy='50%' outerRadius={100}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      {data.length > 0 && (
        <Button
          variant='ghost'
          size='sm'
          onClick={onViewDetail}
          className='self-end'
          data-cy='chart-see-detail'
        >
          {stat.seeDetail}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add front/app/game/alliances/_components/member-champion-chart.tsx
git commit -m "feat(stats): add MemberChampionChart pie chart component"
```

---

## Task 9: Frontend — ChampionDetailModal component

**Files:**
- Create: `front/app/game/alliances/_components/champion-detail-modal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useI18n } from '@/app/i18n';
import type { ChampionUsageItem } from '@/app/services/statistics';

interface ChampionDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: ChampionUsageItem[];
  metric: 'fights' | 'kos';
  playerName: string | null;
}

export function ChampionDetailModal({
  open,
  onClose,
  data,
  metric,
  playerName,
}: ChampionDetailModalProps) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;

  const sorted = [...data].sort((a, b) =>
    metric === 'fights' ? b.fight_count - a.fight_count : b.total_kos - a.total_kos,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-w-lg' data-cy='champion-detail-modal'>
        <DialogHeader>
          <DialogTitle>{playerName ?? stat.allianceView}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{stat.columns.player}</TableHead>
              <TableHead className='text-right'>{stat.columns.fights}</TableHead>
              <TableHead className='text-right'>{stat.columns.kos}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => (
              <TableRow key={c.champion_id}>
                <TableCell>{c.champion_name}</TableCell>
                <TableCell className='text-right'>{c.fight_count}</TableCell>
                <TableCell className='text-right'>{c.total_kos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add front/app/game/alliances/_components/champion-detail-modal.tsx
git commit -m "feat(stats): add ChampionDetailModal component"
```

---

## Task 10: Frontend — Redesign alliance-statistics-tab.tsx

**Files:**
- Modify: `front/app/game/alliances/_components/alliance-statistics-tab.tsx`

This task rewrites the component to add the two-column layout, row click, and war filter. Read the file first, then replace its content entirely with the version below. The existing filters (ratio, group) are preserved; the war filter is added next to them.

- [ ] **Step 1: Read the current file to understand its full structure before editing**

Read `front/app/game/alliances/_components/alliance-statistics-tab.tsx` to confirm the current props interface and table structure match what's expected.

- [ ] **Step 2: Replace the file content**

The new file keeps all existing sort/filter logic and adds: `useChampionStats` hook, war filter dropdown, row click selection, and the two-column layout.

```tsx
'use client';

import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { Alliance } from '@/app/services/game';
import type { PlayerSeasonStats } from '@/app/services/statistics';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberChampionChart } from './member-champion-chart';
import { ChampionDetailModal } from './champion-detail-modal';
import { useChampionStats } from './use-champion-stats';

interface AllianceStatisticsTabProps {
  alliances: Alliance[];
  selectedAllianceId: string;
  onAllianceChange: (allianceId: string) => void;
  seasonStats: PlayerSeasonStats[];
  statsLoading: boolean;
  statsError: string;
  onRetry: () => Promise<void>;
}

type SortField =
  | 'total_fights'
  | 'total_kos'
  | 'total_miniboss'
  | 'total_boss'
  | 'total_not_fought'
  | 'ratio'
  | 'score';
type SortDir = 'asc' | 'desc';

const RATIO_OPTIONS = [-Infinity, 0, 50, 60, 70, 80, 90];

function toGroupValue(group: number | null): string {
  return group === null ? 'none' : String(group);
}

interface SortableHeadProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}

function SortableHead({ label, field, sortField, sortDir, onSort }: SortableHeadProps) {
  const active = sortField === field;
  const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <TableHead className='text-right'>
      <button
        type='button'
        onClick={() => onSort(field)}
        className='inline-flex items-center justify-end gap-1 w-full hover:text-foreground transition-colors'
      >
        {label}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-foreground' : 'opacity-40'}`} />
      </button>
    </TableHead>
  );
}

export default function AllianceStatisticsTab({
  alliances,
  selectedAllianceId,
  onAllianceChange,
  seasonStats,
  statsLoading,
  statsError,
  onRetry,
}: AllianceStatisticsTabProps) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;
  const [ratioMin, setRatioMin] = useState(-Infinity);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [sortField, setSortField] = useState<SortField>('ratio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const {
    selectedGameAccountId,
    selectedWarId,
    setSelectedWarId,
    championUsage,
    chartMetric,
    setChartMetric,
    detailOpen,
    setDetailOpen,
    wars,
    chartLoading,
    handleRowClick,
  } = useChampionStats(selectedAllianceId);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const availableGroups = useMemo(
    () =>
      Array.from(new Set(seasonStats.map((row) => toGroupValue(row.alliance_group)))).sort(
        (a, b) => {
          if (a === 'none') return 1;
          if (b === 'none') return -1;
          return Number(a) - Number(b);
        },
      ),
    [seasonStats],
  );

  const filteredStats = useMemo(() => {
    let rows = seasonStats;
    if (ratioMin !== -Infinity) rows = rows.filter((r) => r.ratio >= ratioMin);
    if (selectedGroup !== 'all') {
      rows = rows.filter((r) => toGroupValue(r.alliance_group) === selectedGroup);
    }
    return [...rows].sort((a, b) => {
      const av = a[sortField as keyof typeof a] as number;
      const bv = b[sortField as keyof typeof b] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [seasonStats, ratioMin, selectedGroup, sortField, sortDir]);

  const selectedPlayer = useMemo(
    () => seasonStats.find((s) => s.id === selectedGameAccountId) ?? null,
    [seasonStats, selectedGameAccountId],
  );

  const hasFilters =
    selectedGroup !== 'all' || ratioMin !== -Infinity || sortField !== 'ratio' || sortDir !== 'desc';

  if (statsLoading) {
    return <p className='text-sm text-muted-foreground py-6 text-center'>{stat.loading}</p>;
  }
  if (statsError) {
    return (
      <div className='flex flex-col items-center gap-2 py-6'>
        <p className='text-sm text-destructive'>{statsError}</p>
        <Button size='sm' variant='outline' onClick={onRetry}>{stat.retry}</Button>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* Alliance selector */}
      {alliances.length > 1 && (
        <Select value={selectedAllianceId} onValueChange={onAllianceChange}>
          <SelectTrigger className='w-52' data-cy='statistics-alliance-select'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {alliances.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {seasonStats.length === 0 ? (
        <p className='text-sm text-muted-foreground py-6 text-center'>{stat.empty}</p>
      ) : (
        <>
          {/* Filters bar */}
          <div className='flex flex-wrap items-center gap-3'>
            {/* War filter */}
            <Select
              value={selectedWarId ?? 'all'}
              onValueChange={(v) => setSelectedWarId(v === 'all' ? null : v)}
            >
              <SelectTrigger className='w-44' data-cy='statistics-war-filter'>
                <SelectValue placeholder={stat.allWars} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all' data-cy='statistics-war-all'>{stat.allWars}</SelectItem>
                {wars.map((w) => (
                  <SelectItem key={w.id} value={w.id} data-cy={`statistics-war-${w.id}`}>
                    {w.opponent_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Ratio filter */}
            <Select
              value={String(ratioMin)}
              onValueChange={(v) => setRatioMin(Number(v))}
            >
              <SelectTrigger className='w-44' data-cy='statistics-ratio-filter'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATIO_OPTIONS.map((value) => (
                  <SelectItem
                    key={value === -Infinity ? 'all' : value}
                    value={String(value)}
                    data-cy={`statistics-ratio-option-${value === -Infinity ? 'all' : value}`}
                  >
                    {value === -Infinity ? stat.ratioAll : `${stat.ratioMin} ≥ ${value}%`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Group filter */}
            {availableGroups.length > 1 && (
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className='w-36' data-cy='statistics-group-filter'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>{stat.allGroups}</SelectItem>
                  {availableGroups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === 'none' ? stat.noGroup : `${stat.groups} ${g}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasFilters && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  setRatioMin(-Infinity);
                  setSelectedGroup('all');
                  setSortField('ratio');
                  setSortDir('desc');
                }}
                data-cy='statistics-reset-filters'
              >
                {stat.resetFilters}
              </Button>
            )}
          </div>

          {/* Two-column layout */}
          <div className='flex flex-col lg:flex-row gap-6'>
            {/* Table */}
            <div className='flex-1 min-w-0'>
              {filteredStats.length === 0 ? (
                <p className='text-sm text-muted-foreground py-4 text-center'>
                  {stat.noFilteredResults}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{stat.columns.player}</TableHead>
                      <TableHead className='text-right'>{stat.columns.group}</TableHead>
                      <SortableHead label={stat.columns.fights} field='total_fights' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.kos} field='total_kos' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.miniboss} field='total_miniboss' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.boss} field='total_boss' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.notFought} field='total_not_fought' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.ratio} field='ratio' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.score} field='score' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStats.map((row) => {
                      const isSelected = row.id === selectedGameAccountId;
                      return (
                        <TableRow
                          key={row.id}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}`}
                          onClick={() => handleRowClick(row.id)}
                          data-cy={`statistics-row-${row.id}`}
                        >
                          <TableCell className='py-1.5 font-medium'>{row.game_pseudo}</TableCell>
                          <TableCell className='py-1.5 text-right text-muted-foreground'>
                            {row.alliance_group ?? '—'}
                          </TableCell>
                          <TableCell className='py-1.5 text-right'>{row.total_fights}</TableCell>
                          <TableCell className='py-1.5 text-right'>{row.total_kos}</TableCell>
                          <TableCell className='py-1.5 text-right'>{row.total_miniboss}</TableCell>
                          <TableCell className='py-1.5 text-right'>{row.total_boss}</TableCell>
                          <TableCell className='py-1.5 text-right'>{row.total_not_fought}</TableCell>
                          <TableCell className='py-1.5 text-right'>{row.ratio}%</TableCell>
                          <TableCell className='py-1.5 text-right'>{row.score}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Chart */}
            <div className='w-full lg:w-80 shrink-0'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm'>{stat.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MemberChampionChart
                    data={championUsage}
                    metric={chartMetric}
                    onMetricChange={setChartMetric}
                    onViewDetail={() => setDetailOpen(true)}
                    loading={chartLoading}
                    playerName={selectedPlayer?.game_pseudo ?? null}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <ChampionDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        data={championUsage}
        metric={chartMetric}
        playerName={selectedPlayer?.game_pseudo ?? null}
      />
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript build to verify no errors**

```bash
cd front && npm run build 2>&1 | grep -i "error" | head -30
```

Expected: no TypeScript errors. Fix any that appear before committing.

- [ ] **Step 4: Commit**

```bash
git add front/app/game/alliances/_components/alliance-statistics-tab.tsx
git commit -m "feat(stats): redesign statistics tab with two-column layout and champion chart"
```

---

## Task 11: Final lint + full test run

- [ ] **Step 1: Backend lint**

```bash
cd api && uvx ruff check && uvx ruff format --check
```

Expected: no errors.

- [ ] **Step 2: Run all backend tests**

```bash
cd api && uv run pytest tests/integration/endpoints/statistic_test.py -v
```

Expected: all tests PASS.

- [ ] **Step 3: Frontend build**

```bash
cd front && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(stats): member champion stats — complete implementation"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Backend endpoint ✓ | Auth visitor ✓ | war/game_account filters ✓ | Frontend 2-col layout ✓ | Row click ✓ | War dropdown ✓ | Top 5 + "Autres" ✓ | Metric toggle ✓ | Detail modal ✓ | i18n ✓ | Mobile (flex-col default) ✓
- [x] **No placeholders:** All steps have complete code
- [x] **Type consistency:** `ChampionUsageItem` used in service, hook, chart, modal — same type throughout. `'fights' | 'kos'` metric type consistent across hook → chart → modal
- [x] **War filter:** `War` type has `season_id: string | null` — filtering `w.season_id !== null && w.status === 'ended'` is valid
- [x] **`push_visitor`** signature matches: `push_visitor(alliance, USER2_ID, game_pseudo)` ✓
- [x] **`getWars`** exists at line 141 of `front/app/services/war.ts` ✓
- [x] **i18n keys** `stat.columns.fights`, `stat.columns.kos`, `stat.columns.player` reused from existing keys — no duplication
