# War Snapshot Admin — Plan

**Date:** 2026-05-02
**Branch:** feat/war-fight-record
**Spec:** docs/superpowers/specs/2026-05-02-war-fight-record-design.md

---

## Context

`WarFightRecord` is already built and wired into `end_war`. There is currently no way to know
if a war was already snapshotted, no guard against double-snapshot, and no way to retroactively
snapshot old wars. This plan adds retrocompatibility + an admin UI.

---

## Task 1 — Add `snapshotted_at` to War + guard in snapshot_war

**Files to modify:**
- `api/src/models/War.py`
- `api/src/services/FightRecordService.py`

**Files to create:**
- `api/migrations/versions/<hash>_add_snapshotted_at_to_war.py` (auto-generated)

### Steps

1. Add field to `War` model:
   ```python
   snapshotted_at: Optional[datetime] = Field(default=None)
   ```

2. Generate and apply migration:
   ```bash
   make reset-db
   make create-mig MESSAGE="add_snapshotted_at_to_war"
   make migrate
   ```

3. Update `FightRecordService.snapshot_war`:
   - At the start: if `war.snapshotted_at is not None`, return immediately (skip)
   - After `await session.commit()`: set `war.snapshotted_at = datetime.now()`
     then `await session.commit()` (second commit updates War row)

### Acceptance criteria
- `end_war` called twice on same war does not create duplicate fight records
- `war.snapshotted_at` is set after first snapshot
- Existing tests still pass

---

## Task 2 — Admin service methods + endpoints for force-snapshot and stats

**Files to modify:**
- `api/src/services/FightRecordService.py`
- `api/src/controllers/admin_controller.py`

**Files to create:**
- Add DTOs inline in `api/src/dto/dto_fight_record.py`

### New FightRecordService methods

```python
@classmethod
async def force_snapshot_all(cls, session) -> dict:
    """Snapshot all ended wars with snapshotted_at=None. Returns {"snapshotted": int, "skipped": int}."""
    # Query all War where status=ended AND snapshotted_at IS NULL
    # For each: call cls.snapshot_war(session, war)
    # Return counts

@classmethod
async def get_snapshot_stats(cls, session) -> list[dict]:
    """Returns per-alliance count of snapshotted wars."""
    # SELECT alliance.name, count(war.id) ... WHERE war.snapshotted_at IS NOT NULL
    # GROUP BY alliance_id
    # Returns list of {"alliance_id": UUID, "alliance_name": str, "war_count": int}
```

### New DTOs (add to `dto_fight_record.py`)

```python
class ForceSnapshotResponse(SQLModel):
    snapshotted: int
    skipped: int

class AllianceSnapshotStatResponse(SQLModel):
    alliance_id: uuid.UUID
    alliance_name: str
    war_count: int
```

### New admin endpoints (add to `admin_controller.py`)

```
POST /admin/wars/force-snapshot
  → FightRecordService.force_snapshot_all(session)
  → returns ForceSnapshotResponse

GET /admin/wars/snapshot-stats
  → FightRecordService.get_snapshot_stats(session)
  → returns list[AllianceSnapshotStatResponse]
```

### Acceptance criteria
- `POST /admin/wars/force-snapshot` snapshots all unsnapshotted ended wars, returns counts
- Called again immediately returns `{"snapshotted": 0, "skipped": N}` (guard works)
- `GET /admin/wars/snapshot-stats` returns per-alliance counts correctly
- Integration tests cover both endpoints

---

## Task 3 — Frontend: Knowledge Base tab on admin page

**Files to create:**
- `front/app/admin/_components/knowledge-base-panel.tsx`
- `front/app/services/fight-records.ts`

**Files to modify:**
- `front/app/admin/_viewmodels/use-admin-viewmodel.ts` — add `KnowledgeBase` tab
- `front/app/admin/_components/admin-content.tsx` — render new tab + panel
- `front/app/i18n/locales/en.ts` — add i18n keys
- `front/app/i18n/locales/fr.ts` — add i18n keys

### i18n keys to add (under `admin` namespace)

```ts
knowledgeBase: {
  tab: "Knowledge Base",          // FR: "Base de connaissances"
  refreshButton: "Refresh Wars",  // FR: "Synchroniser les guerres"
  refreshing: "Refreshing...",    // FR: "Synchronisation..."
  refreshSuccess: "{{snapshotted}} war(s) snapshotted",  // FR: "{{snapshotted}} guerre(s) enregistrée(s)"
  allianceColumn: "Alliance",     // FR: "Alliance"
  warsColumn: "Recorded Wars",    // FR: "Guerres enregistrées"
  noData: "No data yet.",         // FR: "Aucune donnée."
}
```

### Service (`fight-records.ts`)

```ts
export async function forceSnapshotWars(): Promise<{ snapshotted: number; skipped: number }>
export async function getSnapshotStats(): Promise<{ alliance_id: string; alliance_name: string; war_count: number }[]>
```

### Panel (`knowledge-base-panel.tsx`)

- On mount: fetch `getSnapshotStats()` and display table (alliance | war count)
- "Refresh Wars" button: calls `forceSnapshotWars()`, shows result toast/inline message,
  then re-fetches stats to update table
- Loading + error states handled

### Tab wiring

- Add `KnowledgeBase = "knowledge-base"` to `AdminTab` enum
- Add tab item with label from `t.admin.knowledgeBase.tab`
- Render `<KnowledgeBasePanel />` when active tab is `KnowledgeBase`

### Acceptance criteria
- Tab visible on admin page
- Stats table loads on tab open
- Refresh button calls endpoint, shows feedback, refreshes table
- All strings i18n (en + fr)
- No hardcoded strings
