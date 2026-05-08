# Visitor System Design

**Date:** 2026-05-08  
**Feature:** Alliance Visitor System  
**Status:** Approved

---

## Overview

A game account can visit multiple alliances simultaneously. Visitors are trusted read-only spectators — they see everything (war map, rosters, defense) but cannot modify anything. An alliance can have at most 10 visitors at a time.

---

## Backend Models & DB

### New enum: `InvitationType`

File: `api/src/enums/InvitationType.py`

```python
class InvitationType(str, Enum):
    MEMBER = "member"
    VISITOR = "visitor"
```

### Modified: `AllianceInvitation`

Add field:
```python
type: InvitationType = Field(default=InvitationType.MEMBER)
```

Existing invitation flow is reused. Officers can now send invitations of either type. Visitors see their pending invitations (MEMBER or VISITOR) in the same invitations UI with a distinct badge.

### New table: `AllianceVisitor`

Mirrors `AllianceOfficer`. Created on acceptance of a VISITOR invitation, deleted on removal (by officer or visitor themselves).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `alliance_id` | UUID | FK → alliance |
| `game_account_id` | UUID | FK → game_account |
| `visited_since` | datetime | default now() |

Relations:
- `Alliance.visitors` ↔ `GameAccount.visited_alliances`

### Alembic migration

One migration:
- Add `type` column to `alliance_invitation` (default `member`)
- Create `alliance_visitor` table

### No changes to `GameAccount`

Visited alliances are tracked via `AllianceVisitor`, not `GameAccount.alliance_id`. A visitor's `alliance_id` remains `None` (or their own alliance if they're a member elsewhere).

---

## Backend Permissions & Endpoints

### New dependency: `get_member_or_visitor`

```python
async def get_member_or_visitor(alliance_id, current_account, session):
    is_member = current_account.alliance_id == alliance_id
    is_visitor = await session.exec(
        select(AllianceVisitor).where(
            AllianceVisitor.alliance_id == alliance_id,
            AllianceVisitor.game_account_id == current_account.id,
        )
    ).first()
    if not is_member and not is_visitor:
        raise HTTPException(403)
    return current_account
```

### Endpoints updated (swap Depends to `get_member_or_visitor`)

- `GET /alliances/{id}` — alliance info
- `GET /alliances/{id}/wars` — war list
- `GET /alliances/{id}/wars/{war_id}` — war detail
- `GET /alliances/{id}/members` — member list
- `GET /champion-users` when filtered by alliance
- `GET /game-accounts/{id}/champions` — roster of any member or visitor of the same alliance (member OR visitor of that alliance can access rosters of all other members and visitors)

### New endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/alliances/{id}/invitations` | officer | Already exists — now accepts `type: VISITOR` |
| `GET` | `/alliances/{id}/visitors` | member/officer only (not visitor) | List current visitors |
| `DELETE` | `/alliances/{id}/visitors/{visitor_id}` | officer | Kick a visitor |
| `DELETE` | `/alliances/{id}/visitors/me` | visitor | Leave voluntarily |

### Business rules

- **Max 10 visitors:** enforced at invitation send time (not acceptance) in the service layer.
- **Conversion to member:** when a visitor accepts a `type=MEMBER` invitation, the service deletes their `AllianceVisitor` record and sets `GameAccount.alliance_id`.
- **Upgrade requests:** visitors cannot create upgrade requests on alliance members' accounts.
- **Visitor cannot see visitor list:** `GET /alliances/{id}/visitors` requires member/officer — visitors are excluded.

---

## Frontend

### War dropdown (alliance selector)

- Shows both own alliance (member) and visited alliances.
- Visited alliances show an `Eye` icon (lucide-react) next to the name.
- War context adds `isVisitor: boolean` derived from the selected alliance.

### War page — visitor behavior

- `canManageWar = false` when visitor → clear/end/mode toggle buttons hidden, map is read-only.
- Visitor sees the full war map, attacker panel, and prefights in read-only mode.
- Visitor does not appear in the attacker list (they are not part of the team).

### Alliance page — visitor section

- New "Visiteurs" group displayed below BG1 / BG2 / BG3 / Sans groupe.
- Each visitor row: pseudo, clickable roster (reuses `alliance-roster-dialog`), and for officers:
  - "Inviter comme membre" button → sends a MEMBER invitation
  - Remove button (X icon) → opens `ConfirmationDialog` before kicking (`data-cy='confirmation-dialog-confirm'`)
- Visitors themselves see the visitor section but cannot manage it.

### Invitations UI

- Existing invitations tab shows both MEMBER and VISITOR invitations.
- VISITOR invitations display a distinct badge (e.g., `Eye` icon + "Visiteur").
- Accepting a VISITOR invitation → creates `AllianceVisitor`, does not set `alliance_id`.

### Account page

- Upgrade request section is hidden/disabled for visited alliances.

---

## Data Flow — Visitor Lifecycle

```
Officer sends VISITOR invitation
  → AllianceInvitation(type=VISITOR, status=PENDING) created
  → Max 10 check: count(AllianceVisitor where alliance_id=X) < 10

Visitor accepts
  → AllianceInvitation(status=ACCEPTED)
  → AllianceVisitor created

Visitor leaves (DELETE /visitors/me)
  → AllianceVisitor deleted

Officer kicks (DELETE /visitors/{id} + confirmation dialog)
  → AllianceVisitor deleted

Officer invites visitor as member
  → AllianceInvitation(type=MEMBER, status=PENDING) created

Visitor accepts member invitation
  → AllianceVisitor deleted
  → GameAccount.alliance_id = alliance.id
  → AllianceInvitation(status=ACCEPTED)
```

---

## i18n Keys Required

Both `en.ts` and `fr.ts` need:

```
game.alliances.visitors (section label)
game.alliances.inviteAsMemeber
game.alliances.kickVisitor
game.alliances.kickVisitorConfirm
game.alliances.visitorBadge
game.alliances.invitationTypeVisitor
game.war.viewOnly (badge for visitor war view)
```

---

## Testing

**Backend unit tests:**
- `get_member_or_visitor` returns 403 for non-member non-visitor
- Invitation with type VISITOR enforces max 10 limit
- Accepting MEMBER invitation removes AllianceVisitor

**Backend integration tests:**
- Full lifecycle: invite → accept → view war → kick
- Visitor cannot POST/PATCH/DELETE on any alliance endpoint
- Visitor cannot create upgrade request

**E2E (Cypress):**
- `setupVisitorScenario(prefix)` helper returns `{ adminToken, ownerData, visitorData, allianceId }`
- Visitor sees visited alliance in war dropdown with Eye icon
- Visitor cannot see management buttons
- Officer can kick visitor (confirmation dialog)
- Officer can convert visitor to member
