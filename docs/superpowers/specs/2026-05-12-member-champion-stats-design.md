# Design: Member Champion Stats — Alliance Statistics Page

**Date:** 2026-05-12  
**Branch:** feature/member-champion-stats  
**Status:** Approved

---

## Overview

Redesign the alliance statistics tab to show a two-column layout: a compact member stats table on the left and a champion usage pie chart on the right. Clicking a member row updates the chart to show that player's champion breakdown for the current season. A war filter dropdown filters both the table and the chart.

---

## Backend

### New Endpoint

```
GET /statistics/champion-usage/{alliance_id}
```

**Query params (all optional):**
- `game_account_id: UUID` — filter by player; omit for whole alliance
- `war_id: UUID` — filter by a specific war

**Auth:** Current user must be a member or visitor of `alliance_id`. Return 403 otherwise.

**Response:** `list[ChampionUsageResponse]`

```python
class ChampionUsageResponse(SQLModel):
    champion_id: UUID
    champion_name: str
    fight_count: int
    total_kos: int
```

**SQL logic:**
```sql
SELECT champion_id, champion.name, COUNT(*) as fight_count, SUM(ko_count) as total_kos
FROM war_fight_record
JOIN champion ON champion.id = war_fight_record.champion_id
WHERE alliance_id = :alliance_id
  AND season_id = <current_season_id>
  [AND game_account_id = :game_account_id]
  [AND war_id = :war_id]
GROUP BY champion_id
ORDER BY fight_count DESC
```

**Files to create/modify:**
- `api/src/dto/dto_statistic.py` — add `ChampionUsageResponse`
- `api/src/services/StatisticService.py` — add `get_champion_usage()`
- `api/src/controllers/statistic_controller.py` — add route

### Auth Check

Reuse or extend existing `assert_user_in_alliance` to also pass if the user is a visitor (`AllianceVisitor` relation exists for the user's game account in that alliance).

---

## Frontend

### Layout

`alliance-statistics-tab.tsx` becomes a two-column layout:

```
Desktop (lg+):  [ table 60% | pie chart 40% ]
Mobile:         [ table ] → [ pie chart below ]
```

Tailwind: `flex flex-col lg:flex-row gap-6`

### State (viewmodel)

Add to `use-alliances-viewmodel.ts` (or local state in the tab):
- `selectedGameAccountId: string | null` — null = whole alliance view
- `selectedWarId: string | null` — null = all wars
- `championUsage: ChampionUsageItem[]` — fetched data
- `chartMetric: 'fights' | 'kos'` — toggle between fight_count and total_kos

### Filters Bar

Existing: ratio dropdown, group filter, reset button  
**New:** War dropdown (list wars of current season) placed next to the ratio dropdown.

War dropdown requires: `GET /wars?alliance_id=&season_id=current` — verify endpoint exists or add it.

### Table

- Compact row height (remove padding)
- Clicking a row sets `selectedGameAccountId` to that player's game account id
- Clicking the already-selected row deselects (back to alliance view)
- Selected row is visually highlighted (`bg-muted` or ring)
- War filter and ratio filter still apply to the table

### Pie Chart

- Shows top 5 champions sorted by `chartMetric` (fight_count or total_kos)
- Champions beyond top 5 are collapsed into an "Autres" slice
- Toggle button above chart: "Combats" / "KOs"
- Uses shadcn/ui `chart` component (recharts `PieChart` + `Tooltip`)
- When `selectedGameAccountId` is null and `selectedWarId` is null: shows whole-alliance data
- Refetches on `selectedGameAccountId` or `selectedWarId` change

**Chart label format:** `Champion Name — N combats / N KOs`

### Detail Modal

Triggered by a "Voir le détail" button below the pie chart.  
Content: full sorted table `Champion | Combats | KOs` — no pagination, all champions.  
Reuses the same `championUsage` data already fetched (no extra API call).

### New Service Function

In `front/app/services/statistics.ts`:

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
): Promise<ChampionUsageItem[]>
```

---

## Data Flow

```
User action (click row / war filter change)
  → update selectedGameAccountId / selectedWarId
  → call getChampionUsage(allianceId, gameAccountId?, warId?)
  → backend: filter war_fight_record, GROUP BY champion_id
  → return sorted list
  → frontend: slice top 5 + "Autres", render PieChart
```

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `api/src/dto/dto_statistic.py` | Add `ChampionUsageResponse` |
| `api/src/services/StatisticService.py` | Add `get_champion_usage()` |
| `api/src/controllers/statistic_controller.py` | Add GET route |
| `front/app/services/statistics.ts` | Add `getChampionUsage()` + type |
| `front/app/game/alliances/_components/alliance-statistics-tab.tsx` | Redesign layout, add chart, war filter, row click |
| `front/app/game/alliances/_components/member-champion-chart.tsx` | New component — pie chart + toggle + detail button |
| `front/app/game/alliances/_components/champion-detail-modal.tsx` | New component — full champion list modal |
| `front/app/i18n/locales/en.ts` | Add i18n keys |
| `front/app/i18n/locales/fr.ts` | Add i18n keys |

---

## i18n Keys to Add

```
game.alliances.statistics.warFilter
game.alliances.statistics.allWars
game.alliances.statistics.chartFights
game.alliances.statistics.chartKos
game.alliances.statistics.seeDetail
game.alliances.statistics.others
game.alliances.statistics.champion
game.alliances.statistics.fights
game.alliances.statistics.kos
game.alliances.statistics.allianceView
```

---

## Testing

**Backend unit:** `get_champion_usage` with mock session — test no filter, game_account filter, war filter, 403 non-member/non-visitor.

**Backend integration:** `GET /statistics/champion-usage/{alliance_id}` — test auth (member OK, visitor OK, stranger 403), test filtering, test correct aggregation.

**E2E:** Not required for initial delivery — covered by integration tests.
