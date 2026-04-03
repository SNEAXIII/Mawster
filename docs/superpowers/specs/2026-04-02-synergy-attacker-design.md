# Synergy Attacker — Design Spec

**Date:** 2026-04-02  
**Status:** Approved  
**Feature:** Add synergy champion support to war attack planning

---

## Context

In MCOC alliance war, each member brings a team of 3 champions per battlegroup. Some champions are "main attackers" assigned to fight a specific defense node. Others are "synergy champions" — they are brought along solely for their passive bonus that persists for the entire war, without fighting any node themselves. A champion can also be both (a "couteau suisse"): providing synergy while also being a main attacker on a node.

The current system tracks attackers exclusively via `WarDefensePlacement.attacker_champion_user_id` (node-bound). This design adds a separate mechanism for node-independent synergy champions.

---

## Rules

- Each member has **3 attacker slots** per war + battlegroup.
- A slot = 1 unique `champion_user_id`.
- Slots are counted as the **union** of:
  - `WarDefensePlacement.attacker_champion_user_id` for that member in that war+BG
  - `WarSynergyAttacker.champion_user_id` for that member in that war+BG
- A "couteau suisse" champion appears in both sets but counts as **1 slot** (union deduplicates).
- A synergy champion is **not linked to a node** — its bonus applies to the whole war.
- A synergy champion **is linked to a specific attacker champion** (`target_champion_user_id`) for statistics and traceability.
- A synergy champion cannot be placed in alliance defense for the same BG (same rule as node attackers).
- A champion can only be synergy **once** per war+BG (unique constraint).

---

## Data Model

### New table: `WarSynergyAttacker`

```python
class WarSynergyAttacker(SQLModel, table=True):
    __tablename__ = "war_synergy_attacker"
    __table_args__ = (
        UniqueConstraint("war_id", "battlegroup", "champion_user_id",
                         name="uq_war_synergy_champion"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_id: uuid.UUID = Field(foreign_key="war.id")
    battlegroup: int = Field(ge=1, le=3)
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")        # the synergy provider
    target_champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id") # the attacker that benefits
    created_at: datetime = Field(default_factory=datetime.now)
```

No changes to existing `WarDefensePlacement` model.

### 3-slot counting logic

```python
# Existing node attackers for this member
node_ids = {p.attacker_champion_user_id for p in node_placements if p.attacker_champion_user_id}

# Synergy champions for this member
synergy_ids = {s.champion_user_id for s in synergy_placements}

total_slots_used = len(node_ids | synergy_ids)
assert total_slots_used <= 3
```

---

## Backend API

All endpoints under: `POST /alliances/{alliance_id}/wars/{war_id}/bg/{battlegroup}/synergy`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/synergy` | Add a synergy champion | Member |
| `DELETE` | `/synergy/{champion_user_id}` | Remove a synergy champion | Member |
| `GET` | `/synergy` | List synergy champions for the BG | Member |

### POST body

```json
{
  "champion_user_id": "uuid",
  "target_champion_user_id": "uuid"
}
```

### Service validations (in order)

1. `champion_user_id` belongs to a member of this alliance + battlegroup.
2. `target_champion_user_id` is assigned as a node attacker in this war + BG.
3. `champion_user_id` is not already in synergy for this war + BG (unique constraint).
4. `champion_user_id` is not placed in alliance defense for this BG.
5. Union of node attackers + synergies for this member ≤ 3.

### Champion pool for synergy selection

Reuse the existing `get_available_attackers` endpoint — same pool, same defense exclusion filter. No new endpoint needed.

---

## Frontend

### Attacker panel changes

- Each champion icon in the 3-slot row is **clickable**.
- Click opens a **popover** with context-sensitive actions:
  - If no synergy is bound to this attacker → **"Ajouter une synergie"** button
  - If a synergy is already bound to this attacker → shows synergy champion + **"Révoquer"** button

### Synergy champion slot display

- Synergy-only champions (no node) appear in the 3 slots with a **`SynergyBadge`** overlay icon.
- "Couteau suisse" champions show both their node indicator and the synergy badge.
- Hover tooltip: `war.synergy.for` + target champion name.

### New component

**`SynergyBadge`** — small overlay badge on a champion icon indicating synergy status.

### i18n keys (en + fr)

| Key | Usage |
|-----|-------|
| `war.synergy.add` | "Add a synergy" button |
| `war.synergy.revoke` | "Revoke" button |
| `war.synergy.label` | "Synergy" label |
| `war.synergy.for` | "Synergy for: [champion]" |
| `war.synergy.tooltip` | Tooltip text on badge |

---

## Testing

### Backend

- Unit: slot counting logic with synergy-only, node-only, and couteau-suisse champions.
- Integration: POST synergy (happy path, limit exceeded, defense conflict, duplicate).
- Integration: DELETE synergy.
- Integration: slot count deduplication when same champion is node + synergy.

### E2E

- `setupAttackerScenario` extended or new `setupSynergyScenario` helper.
- `cy.apiAddWarSynergy(token, allianceId, warId, battlegroup, championUserId, targetChampionUserId)`
- Scenarios: add synergy, revoke synergy, 3-slot limit enforced with mix of node + synergy, couteau suisse counts as 1.

---

## Out of scope

- Synergy champion from a different member (always same member's slot).
- Multiple synergy champions per target attacker (one synergy per champion_user_id, no per-target limit enforced at DB level — handled by 3-slot total cap).
- KO tracking for synergy champions (they don't fight nodes).
