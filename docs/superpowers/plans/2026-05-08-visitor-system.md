# Visitor System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow game accounts to visit multiple alliances as read-only spectators, invited via the existing invitation flow.

**Architecture:** New `AllianceVisitor` association table (mirrors `AllianceOfficer`) stores active visits. `AllianceInvitation` gains a `type` field (MEMBER/VISITOR). Accept-invitation branches on type: MEMBER → existing join flow, VISITOR → create AllianceVisitor. Backend uses explicit `get_member_or_visitor_account` checks on GET endpoints. Frontend merges member + visited alliances in the selector with an Eye badge.

**Tech Stack:** FastAPI + SQLModel + Alembic (backend), Next.js + React + Tailwind + lucide-react (frontend), pytest (tests), Cypress (E2E).

---

## File Map

**Create:**
- `api/src/enums/InvitationType.py`
- `api/src/models/AllianceVisitor.py`
- `api/src/services/AllianceVisitorService.py`
- `api/src/Messages/visitor_messages.py`
- `api/src/dto/dto_visitor.py`
- `api/tests/integration/endpoints/test_alliance_visitor.py`
- `front/app/game/alliances/_components/alliance-visitors-section.tsx`

**Modify:**
- `api/src/models/AllianceInvitation.py` — add `type` field
- `api/src/models/Alliance.py` — add `visitors` relation
- `api/src/models/GameAccount.py` — add `visited_alliances` relation
- `api/src/models/AllianceVisitor.py` — (new, see above)
- `api/src/services/AllianceInvitationService.py` — branch on type in accept/create
- `api/src/services/AllianceService.py` — add `get_member_or_visitor_account`, `get_my_visited_alliances`
- `api/src/dto/dto_invitation.py` — add `type` to request + response
- `api/src/dto/dto_alliance.py` — (no change to AllianceResponse — visitors fetched separately)
- `api/src/controllers/alliance_controller.py` — new visitor endpoints, update invite
- `api/tests/integration/endpoints/setup/game_setup.py` — add `push_visitor` helper
- `front/app/services/game.ts` — add types + API calls
- `front/hooks/use-alliance-selector.ts` — merge visited alliances
- `front/app/contexts/war-context.tsx` — expose `isVisitor`
- `front/app/game/war/_components/war-management-bar.tsx` — Eye badge + read-only guard
- `front/app/game/alliances/_components/alliances-tab.tsx` — visitors section
- `front/app/game/alliances/_components/invitations-section.tsx` — visitor badge
- `front/app/i18n/locales/en.ts` — new keys
- `front/app/i18n/locales/fr.ts` — new keys

---

## Task 1: InvitationType enum + AllianceVisitor model + Relations

**Files:**
- Create: `api/src/enums/InvitationType.py`
- Create: `api/src/models/AllianceVisitor.py`
- Modify: `api/src/models/Alliance.py`
- Modify: `api/src/models/GameAccount.py`
- Modify: `api/src/models/AllianceInvitation.py`

- [ ] **Step 1: Create InvitationType enum**

```python
# api/src/enums/InvitationType.py
from enum import Enum


class InvitationType(str, Enum):
    MEMBER = "member"
    VISITOR = "visitor"
```

- [ ] **Step 2: Create AllianceVisitor model**

```python
# api/src/models/AllianceVisitor.py
import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount


class AllianceVisitor(SQLModel, table=True):
    """A game account that is visiting an alliance as a read-only spectator."""

    __tablename__ = "alliance_visitor"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    visited_since: datetime = Field(default_factory=datetime.now)

    # Relations
    alliance: "Alliance" = Relationship(back_populates="visitors")
    game_account: "GameAccount" = Relationship(back_populates="visited_alliances")
```

- [ ] **Step 3: Add `visitors` relation to Alliance.py**

Add import and relation:
```python
# At the top with TYPE_CHECKING imports, add:
from src.models.AllianceVisitor import AllianceVisitor  # inside TYPE_CHECKING block

# In class Alliance, add after existing relations:
visitors: List["AllianceVisitor"] = Relationship(back_populates="alliance")
```

Full updated `Alliance.py`:
```python
import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING
import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.GameAccount import GameAccount
    from src.models.AllianceOfficer import AllianceOfficer
    from src.models.AllianceInvitation import AllianceInvitation
    from src.models.AllianceVisitor import AllianceVisitor


class Alliance(SQLModel, table=True):
    __tablename__ = "alliance"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=50)
    tag: str = Field(max_length=5)
    owner_id: uuid.UUID = Field(
        sa_column=sa.Column(
            sa.Uuid(),
            sa.ForeignKey("game_account.id", use_alter=True),
            nullable=False,
        )
    )
    created_at: datetime = Field(default_factory=datetime.now)
    elo: int = Field(default=0)
    tier: int = Field(default=20)

    # Relations
    owner: "GameAccount" = Relationship(
        back_populates="owned_alliance",
        sa_relationship_kwargs={"foreign_keys": "[Alliance.owner_id]"},
    )
    members: List["GameAccount"] = Relationship(
        back_populates="alliance",
        sa_relationship_kwargs={"foreign_keys": "[GameAccount.alliance_id]"},
    )
    officers: List["AllianceOfficer"] = Relationship(back_populates="alliance")
    invitations: List["AllianceInvitation"] = Relationship(
        back_populates="alliance",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.alliance_id]"},
    )
    visitors: List["AllianceVisitor"] = Relationship(back_populates="alliance")
```

- [ ] **Step 4: Add `visited_alliances` relation to GameAccount.py**

```python
# Add inside TYPE_CHECKING block:
from src.models.AllianceVisitor import AllianceVisitor

# Add after existing relations:
visited_alliances: List["AllianceVisitor"] = Relationship(back_populates="game_account")
```

Full updated `GameAccount.py`:
```python
import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.User import User
    from src.models.Alliance import Alliance
    from src.models.ChampionUser import ChampionUser
    from src.models.AllianceOfficer import AllianceOfficer
    from src.models.AllianceInvitation import AllianceInvitation
    from src.models.AllianceVisitor import AllianceVisitor
    from src.models.RequestedUpgrade import RequestedUpgrade


class GameAccount(SQLModel, table=True):
    __tablename__ = "game_account"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    alliance_id: Optional[uuid.UUID] = Field(default=None, foreign_key="alliance.id")
    alliance_group: Optional[int] = Field(default=None)
    game_pseudo: str = Field(max_length=16)
    is_primary: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)

    # Relations
    user: "User" = Relationship(back_populates="game_accounts")
    alliance: Optional["Alliance"] = Relationship(
        back_populates="members",
        sa_relationship_kwargs={"foreign_keys": "[GameAccount.alliance_id]"},
    )
    owned_alliance: Optional["Alliance"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={"foreign_keys": "[Alliance.owner_id]"},
    )
    roster: List["ChampionUser"] = Relationship(back_populates="game_account")
    officer_entries: List["AllianceOfficer"] = Relationship(back_populates="game_account")
    received_invitations: List["AllianceInvitation"] = Relationship(
        back_populates="game_account",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.game_account_id]"},
    )
    sent_invitations: List["AllianceInvitation"] = Relationship(
        back_populates="invited_by",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.invited_by_game_account_id]"},
    )
    visited_alliances: List["AllianceVisitor"] = Relationship(back_populates="game_account")
    requested_upgrades: List["RequestedUpgrade"] = Relationship(
        back_populates="requester",
        sa_relationship_kwargs={"foreign_keys": "[RequestedUpgrade.requester_game_account_id]"},
    )
```

- [ ] **Step 5: Add `type` field to AllianceInvitation**

```python
# api/src/models/AllianceInvitation.py
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

from src.enums.InvitationStatus import InvitationStatus
from src.enums.InvitationType import InvitationType

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount


class AllianceInvitation(SQLModel, table=True):
    """An invitation for a game account to join or visit an alliance."""

    __tablename__ = "alliance_invitation"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    invited_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    status: InvitationStatus = Field(default=InvitationStatus.PENDING)
    type: InvitationType = Field(default=InvitationType.MEMBER)
    created_at: datetime = Field(default_factory=datetime.now)
    responded_at: Optional[datetime] = Field(default=None)

    # Relations
    alliance: "Alliance" = Relationship(
        back_populates="invitations",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.alliance_id]"},
    )
    game_account: "GameAccount" = Relationship(
        back_populates="received_invitations",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.game_account_id]"},
    )
    invited_by: "GameAccount" = Relationship(
        back_populates="sent_invitations",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.invited_by_game_account_id]"},
    )
```

- [ ] **Step 6: Register AllianceVisitor in models __init__**

Open `api/src/models/__init__.py` and add:
```python
from src.models.AllianceVisitor import AllianceVisitor  # noqa: F401
```

- [ ] **Step 7: Commit**

```bash
git add api/src/enums/InvitationType.py api/src/models/AllianceVisitor.py api/src/models/Alliance.py api/src/models/GameAccount.py api/src/models/AllianceInvitation.py api/src/models/__init__.py
git commit -m "feat(visitor): add InvitationType enum, AllianceVisitor model, relations"
```

---

## Task 2: Alembic migration

**Files:**
- New migration file under `migrations/versions/`

- [ ] **Step 1: Reset DB (required before any migration)**

Use skill: `/db-reset`

- [ ] **Step 2: Create migration**

Use skill: `/db-migrate` with `MESSAGE="add_alliance_visitor_and_invitation_type"`

Or directly:
```bash
cd api && uv run alembic revision --autogenerate -m "add_alliance_visitor_and_invitation_type"
```

- [ ] **Step 3: Verify generated migration**

Open the new file under `migrations/versions/`. Confirm it contains:
- `op.add_column('alliance_invitation', sa.Column('type', sa.String(), nullable=False, server_default='member'))`
- `op.create_table('alliance_visitor', ...)` with columns: `id`, `alliance_id`, `game_account_id`, `visited_since`

If `server_default` is missing on the `type` column, add it manually so existing rows default to `'member'`.

- [ ] **Step 4: Apply migration**

```bash
cd api && uv run alembic upgrade head
```

Expected: `Running upgrade ... -> ..., add_alliance_visitor_and_invitation_type`

- [ ] **Step 5: Commit**

```bash
git add migrations/
git commit -m "feat(visitor): migration — add alliance_visitor table and invitation type column"
```

---

## Task 3: AllianceVisitorService

**Files:**
- Create: `api/src/services/AllianceVisitorService.py`
- Create: `api/src/Messages/visitor_messages.py`

- [ ] **Step 1: Create visitor error messages**

```python
# api/src/Messages/visitor_messages.py
ALLIANCE_MAX_VISITORS_REACHED = "This alliance already has 10 visitors (maximum reached)"
ALREADY_A_VISITOR = "This game account is already visiting this alliance"
NOT_A_VISITOR = "This game account is not visiting this alliance"
VISITOR_NOT_FOUND = "Visitor record not found"
```

- [ ] **Step 2: Write failing tests for AllianceVisitorService**

```python
# api/tests/unit/services/test_alliance_visitor_service.py
import uuid
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from src.services.AllianceVisitorService import AllianceVisitorService


@pytest.mark.asyncio
async def test_count_visitors_returns_zero():
    session = AsyncMock()
    session.exec = AsyncMock(return_value=MagicMock(one=lambda: 0))
    count = await AllianceVisitorService.count_visitors(session, uuid.uuid4())
    assert count == 0


@pytest.mark.asyncio
async def test_is_visitor_false_when_not_found():
    session = AsyncMock()
    session.exec = AsyncMock(return_value=MagicMock(first=lambda: None))
    result = await AllianceVisitorService.is_visitor(session, uuid.uuid4(), uuid.uuid4())
    assert result is False
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd api && uv run pytest tests/unit/services/test_alliance_visitor_service.py -v
```

Expected: `ModuleNotFoundError` or `ImportError` — `AllianceVisitorService` doesn't exist yet.

- [ ] **Step 4: Create AllianceVisitorService**

```python
# api/src/services/AllianceVisitorService.py
import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy import func
from starlette import status

from src.models.AllianceVisitor import AllianceVisitor
from src.Messages.visitor_messages import (
    ALREADY_A_VISITOR,
    NOT_A_VISITOR,
    VISITOR_NOT_FOUND,
)
from src.utils.db import SessionDep

MAX_VISITORS_PER_ALLIANCE = 10


class AllianceVisitorService:
    @staticmethod
    async def count_visitors(session: SessionDep, alliance_id: uuid.UUID) -> int:
        result = await session.exec(
            select(func.count(AllianceVisitor.id)).where(
                AllianceVisitor.alliance_id == alliance_id
            )
        )
        return result.one()

    @staticmethod
    async def find_visitor(
        session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> Optional[AllianceVisitor]:
        result = await session.exec(
            select(AllianceVisitor).where(
                AllianceVisitor.alliance_id == alliance_id,
                AllianceVisitor.game_account_id == game_account_id,
            )
        )
        return result.first()

    @staticmethod
    async def is_visitor(
        session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> bool:
        result = await session.exec(
            select(AllianceVisitor).where(
                AllianceVisitor.alliance_id == alliance_id,
                AllianceVisitor.game_account_id == game_account_id,
            )
        )
        return result.first() is not None

    @classmethod
    async def create_visitor(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> AllianceVisitor:
        existing = await cls.find_visitor(session, alliance_id, game_account_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ALREADY_A_VISITOR,
            )
        visitor = AllianceVisitor(
            alliance_id=alliance_id,
            game_account_id=game_account_id,
        )
        session.add(visitor)
        await session.commit()
        await session.refresh(visitor)
        return visitor

    @classmethod
    async def remove_visitor(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> None:
        visitor = await cls.find_visitor(session, alliance_id, game_account_id)
        if visitor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=NOT_A_VISITOR,
            )
        await session.delete(visitor)
        await session.commit()

    @classmethod
    async def remove_if_visitor(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> None:
        """Remove visitor record if it exists. No error if not a visitor."""
        visitor = await cls.find_visitor(session, alliance_id, game_account_id)
        if visitor is not None:
            await session.delete(visitor)

    @classmethod
    async def get_visitors(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> list[AllianceVisitor]:
        from sqlalchemy.orm import selectinload
        result = await session.exec(
            select(AllianceVisitor)
            .where(AllianceVisitor.alliance_id == alliance_id)
            .options(selectinload(AllianceVisitor.game_account))  # type: ignore[arg-type]
        )
        return result.all()

    @classmethod
    async def get_visited_alliances(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[AllianceVisitor]:
        """Return all active visits for game accounts belonging to this user."""
        from sqlmodel import select as sel
        from src.models.GameAccount import GameAccount
        from sqlalchemy.orm import selectinload

        # Get all game account IDs for this user
        accs = await session.exec(sel(GameAccount).where(GameAccount.user_id == user_id))
        account_ids = {acc.id for acc in accs.all()}
        if not account_ids:
            return []
        result = await session.exec(
            select(AllianceVisitor)
            .where(AllianceVisitor.game_account_id.in_(account_ids))  # type: ignore[union-attr]
            .options(
                selectinload(AllianceVisitor.alliance),  # type: ignore[arg-type]
            )
        )
        return result.all()
```

- [ ] **Step 5: Run tests**

```bash
cd api && uv run pytest tests/unit/services/test_alliance_visitor_service.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/services/AllianceVisitorService.py api/src/Messages/visitor_messages.py api/tests/unit/services/test_alliance_visitor_service.py
git commit -m "feat(visitor): add AllianceVisitorService and visitor messages"
```

---

## Task 4: Update AllianceInvitationService — handle type

**Files:**
- Modify: `api/src/services/AllianceInvitationService.py`

- [ ] **Step 1: Update `create_invitation` signature and logic**

`create_invitation` needs a `invitation_type` param. For VISITOR invitations:
- Skip the "already in alliance" check (visitor can have their own alliance)
- Skip the member count limit check
- Instead check visitor count < 10
- Check no pending VISITOR invitation already exists (separately from MEMBER)

Replace the full method:

```python
@classmethod
async def create_invitation(
    cls,
    session: SessionDep,
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
    invited_by_user_id: uuid.UUID,
    alliance: Alliance,
    invitation_type: InvitationType = InvitationType.MEMBER,
) -> AllianceInvitation:
    """Create an invitation for a game account to join or visit an alliance."""
    from src.enums.InvitationType import InvitationType as IT
    from src.services.AllianceVisitorService import AllianceVisitorService, MAX_VISITORS_PER_ALLIANCE
    from src.Messages.visitor_messages import ALLIANCE_MAX_VISITORS_REACHED, ALREADY_A_VISITOR

    game_account = await session.get(GameAccount, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)

    if invitation_type == IT.MEMBER:
        # Must not already be in an alliance
        if game_account.alliance_id is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GAME_ACCOUNT_ALREADY_IN_ALLIANCE)
        # Enforce member limit
        count_result = await session.exec(
            select(func.count(GameAccount.id)).where(GameAccount.alliance_id == alliance_id)
        )
        if count_result.one() >= MAX_MEMBERS_PER_ALLIANCE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=alliance_max_members_reached(MAX_MEMBERS_PER_ALLIANCE))
    else:
        # VISITOR: check not already visiting
        already_visitor = await AllianceVisitorService.is_visitor(session, alliance_id, game_account_id)
        if already_visitor:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALREADY_A_VISITOR)
        # Check visitor limit
        visitor_count = await AllianceVisitorService.count_visitors(session, alliance_id)
        if visitor_count >= MAX_VISITORS_PER_ALLIANCE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALLIANCE_MAX_VISITORS_REACHED)

    # Check no pending invitation of the same type already exists
    existing = await session.exec(
        select(AllianceInvitation).where(
            AllianceInvitation.alliance_id == alliance_id,
            AllianceInvitation.game_account_id == game_account_id,
            AllianceInvitation.status == InvitationStatus.PENDING,
            AllianceInvitation.type == invitation_type,
        )
    )
    if existing.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=PENDING_INVITATION_ALREADY_EXISTS)

    # Find inviter's game account in this alliance
    inviter_accounts = await cls._get_user_account_ids(session, invited_by_user_id)
    inviter_ga_id = None
    for acc_id in inviter_accounts:
        ga = await session.get(GameAccount, acc_id)
        if ga and ga.alliance_id == alliance_id:
            inviter_ga_id = ga.id
            break
    if inviter_ga_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITER_NOT_IN_ALLIANCE)

    invitation = AllianceInvitation(
        alliance_id=alliance_id,
        game_account_id=game_account_id,
        invited_by_game_account_id=inviter_ga_id,
        type=invitation_type,
    )
    session.add(invitation)
    await session.commit()
    await session.refresh(invitation)
    return invitation
```

Also add `from src.enums.InvitationType import InvitationType` to the imports at the top of the file.

- [ ] **Step 2: Update `accept_invitation` to branch on type**

Replace the full method:

```python
@classmethod
async def accept_invitation(
    cls, session: SessionDep, invitation_id: uuid.UUID, user_id: uuid.UUID
) -> AllianceInvitation:
    """Accept a pending invitation. MEMBER → join alliance. VISITOR → create AllianceVisitor record."""
    from src.enums.InvitationType import InvitationType as IT
    from src.services.AllianceVisitorService import AllianceVisitorService, MAX_VISITORS_PER_ALLIANCE
    from src.Messages.visitor_messages import ALLIANCE_MAX_VISITORS_REACHED, ALREADY_A_VISITOR

    invitation = await session.get(AllianceInvitation, invitation_id)
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=INVITATION_NOT_FOUND)
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVITATION_NO_LONGER_PENDING)

    user_account_ids = await cls._get_user_account_ids(session, user_id)
    if invitation.game_account_id not in user_account_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITATION_NOT_FOR_YOUR_GAME_ACCOUNT)

    if invitation.type == IT.VISITOR:
        # Check not already visiting
        already_visitor = await AllianceVisitorService.is_visitor(
            session, invitation.alliance_id, invitation.game_account_id
        )
        if already_visitor:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALREADY_A_VISITOR)
        # Check visitor limit
        visitor_count = await AllianceVisitorService.count_visitors(session, invitation.alliance_id)
        if visitor_count >= MAX_VISITORS_PER_ALLIANCE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALLIANCE_MAX_VISITORS_REACHED)
        # Create visitor record (no commit yet — done inside create_visitor)
        from src.models.AllianceVisitor import AllianceVisitor
        visitor = AllianceVisitor(
            alliance_id=invitation.alliance_id,
            game_account_id=invitation.game_account_id,
        )
        session.add(visitor)
        invitation.status = InvitationStatus.ACCEPTED
        invitation.responded_at = datetime.now()
        session.add(invitation)
        await session.commit()
        await session.refresh(invitation)
        return invitation

    # MEMBER flow
    game_account = await session.get(GameAccount, invitation.game_account_id)
    if game_account.alliance_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GAME_ACCOUNT_ALREADY_IN_ALLIANCE)
    count_result = await session.exec(
        select(func.count(GameAccount.id)).where(GameAccount.alliance_id == invitation.alliance_id)
    )
    if count_result.one() >= MAX_MEMBERS_PER_ALLIANCE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=alliance_max_members_reached(MAX_MEMBERS_PER_ALLIANCE))

    # If accepting as member and already a visitor of this alliance, remove visitor status
    await AllianceVisitorService.remove_if_visitor(session, invitation.alliance_id, invitation.game_account_id)

    game_account.alliance_id = invitation.alliance_id
    session.add(game_account)
    invitation.status = InvitationStatus.ACCEPTED
    invitation.responded_at = datetime.now()
    session.add(invitation)
    # Cancel other pending MEMBER invitations for this game account
    other_pending = await session.exec(
        select(AllianceInvitation).where(
            AllianceInvitation.game_account_id == invitation.game_account_id,
            AllianceInvitation.status == InvitationStatus.PENDING,
            AllianceInvitation.id != invitation.id,
            AllianceInvitation.type == IT.MEMBER,
        )
    )
    for other in other_pending.all():
        other.status = InvitationStatus.DECLINED
        other.responded_at = datetime.now()
        session.add(other)
    await session.commit()
    await session.refresh(invitation)
    return invitation
```

- [ ] **Step 3: Run existing alliance tests to check no regression**

```bash
cd api && uv run pytest tests/integration/endpoints/alliance_test.py -v
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add api/src/services/AllianceInvitationService.py
git commit -m "feat(visitor): update invitation service to handle VISITOR type"
```

---

## Task 5: DTOs

**Files:**
- Modify: `api/src/dto/dto_invitation.py`
- Create: `api/src/dto/dto_visitor.py`

- [ ] **Step 1: Add `type` to invitation DTOs**

```python
# api/src/dto/dto_invitation.py
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.enums.InvitationStatus import InvitationStatus
from src.enums.InvitationType import InvitationType


class AllianceInvitationCreateRequest(BaseModel):
    """DTO to invite a game account to an alliance (as member or visitor)."""

    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    type: InvitationType = Field(default=InvitationType.MEMBER)


class AllianceInvitationResponse(BaseModel):
    """Response DTO for an alliance invitation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alliance_id: uuid.UUID
    alliance_name: str
    alliance_tag: str
    game_account_id: uuid.UUID
    game_account_pseudo: str
    invited_by_game_account_id: uuid.UUID
    invited_by_pseudo: str
    status: InvitationStatus
    type: InvitationType
    created_at: datetime
    responded_at: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "alliance_id": data.alliance_id,
            "alliance_name": data.alliance.name,
            "alliance_tag": data.alliance.tag,
            "game_account_id": data.game_account_id,
            "game_account_pseudo": data.game_account.game_pseudo,
            "invited_by_game_account_id": data.invited_by_game_account_id,
            "invited_by_pseudo": data.invited_by.game_pseudo,
            "status": data.status,
            "type": data.type,
            "created_at": data.created_at,
            "responded_at": data.responded_at,
        }
```

- [ ] **Step 2: Create visitor DTO**

```python
# api/src/dto/dto_visitor.py
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class AllianceVisitorResponse(BaseModel):
    """Response DTO for an alliance visitor."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alliance_id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    visited_since: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_game_account(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "alliance_id": data.alliance_id,
            "game_account_id": data.game_account_id,
            "game_pseudo": data.game_account.game_pseudo,
            "visited_since": data.visited_since,
        }
```

- [ ] **Step 3: Commit**

```bash
git add api/src/dto/dto_invitation.py api/src/dto/dto_visitor.py
git commit -m "feat(visitor): update invitation DTO + add visitor DTO"
```

---

## Task 6: AllianceService — visitor access checks

**Files:**
- Modify: `api/src/services/AllianceService.py`

- [ ] **Step 1: Add `get_member_or_visitor_account` method**

Add inside `AllianceService` class:

```python
@classmethod
async def get_member_or_visitor_account(
    cls,
    session: SessionDep,
    alliance_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Raise 403 if the user has no game account that is a member or visitor of this alliance."""
    from src.services.AllianceVisitorService import AllianceVisitorService

    user_accounts = await cls._get_user_accounts(session, user_id)
    # Check member
    for acc in user_accounts:
        if acc.alliance_id == alliance_id:
            return
    # Check visitor
    for acc in user_accounts:
        if await AllianceVisitorService.is_visitor(session, alliance_id, acc.id):
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=NOT_ALLIANCE_MEMBER,
    )

@classmethod
async def get_user_visitor_account(
    cls,
    session: SessionDep,
    alliance_id: uuid.UUID,
    user_id: uuid.UUID,
) -> "GameAccount":
    """Return the user's game account that is a visitor of this alliance. Raises 403 if not found."""
    from src.services.AllianceVisitorService import AllianceVisitorService
    user_accounts = await cls._get_user_accounts(session, user_id)
    for acc in user_accounts:
        if await AllianceVisitorService.is_visitor(session, alliance_id, acc.id):
            return acc
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=NOT_ALLIANCE_MEMBER,
    )
```

- [ ] **Step 2: Add `get_my_visited_alliances` service method**

Add inside `AllianceService` class:

```python
@classmethod
async def get_my_visited_alliances(cls, session: SessionDep, user_id: uuid.UUID) -> list[Alliance]:
    """Return alliances where the user has a game account currently visiting (as visitor)."""
    from src.services.AllianceVisitorService import AllianceVisitorService
    from src.models.AllianceVisitor import AllianceVisitor as AV

    visits = await AllianceVisitorService.get_visited_alliances(session, user_id)
    if not visits:
        return []
    alliance_ids = {v.alliance_id for v in visits}
    sql = (
        select(Alliance)
        .where(Alliance.id.in_(alliance_ids))  # type: ignore[union-attr]
        .options(
            selectinload(Alliance.owner),  # type: ignore[arg-type]
            selectinload(Alliance.members),  # type: ignore[arg-type]
            selectinload(Alliance.officers).selectinload(AllianceOfficer.game_account),  # type: ignore[arg-type]
        )
    )
    result = await session.exec(sql)
    return result.all()
```

- [ ] **Step 3: Commit**

```bash
git add api/src/services/AllianceService.py
git commit -m "feat(visitor): add get_member_or_visitor_account and get_my_visited_alliances"
```

---

## Task 7: Alliance controller — visitor endpoints

**Files:**
- Modify: `api/src/controllers/alliance_controller.py`

- [ ] **Step 1: Add imports**

At the top of the controller, add:
```python
from src.dto.dto_visitor import AllianceVisitorResponse
from src.services.AllianceVisitorService import AllianceVisitorService
```

- [ ] **Step 2: Add `GET /alliances/my-visited` endpoint**

Add after `get_my_alliances`:

```python
@alliance_controller.get(
    "/my-visited",
    response_model=list[AllianceResponse],
)
async def get_my_visited_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get alliances where the current user's game account is currently a visitor."""
    alliances = await AllianceService.get_my_visited_alliances(session, current_user.id)
    return [_to_response(a) for a in alliances]
```

- [ ] **Step 3: Update `invite_member` to pass type**

Replace the `invite_member` endpoint body:

```python
@alliance_controller.post(
    "/{alliance_id}/invitations",
    response_model=AllianceInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    alliance_id: uuid.UUID,
    body: AllianceInvitationCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Invite a game account to join (MEMBER) or visit (VISITOR) the alliance.
    Only the owner or an officer can invite."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)
    invitation = await AllianceInvitationService.create_invitation(
        session=session,
        alliance_id=alliance_id,
        game_account_id=body.game_account_id,
        invited_by_user_id=current_user.id,
        alliance=alliance,
        invitation_type=body.type,
    )
    loaded = await AllianceInvitationService.get_invitations_for_alliance(session, alliance_id)
    inv = next((i for i in loaded if i.id == invitation.id), invitation)
    return _invitation_to_response(inv)
```

- [ ] **Step 4: Add visitor endpoints**

Add after the officers section:

```python
# ---- Visitor management ----


@alliance_controller.get(
    "/{alliance_id}/visitors",
    response_model=list[AllianceVisitorResponse],
)
async def get_alliance_visitors(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all current visitors of an alliance. Only members/officers can view this list."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    visitors = await AllianceVisitorService.get_visitors(session, alliance_id)
    return [AllianceVisitorResponse.model_validate(v) for v in visitors]


@alliance_controller.delete(
    "/{alliance_id}/visitors/{game_account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def kick_visitor(
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove a visitor from the alliance. Only the owner or an officer can kick."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)
    await AllianceVisitorService.remove_visitor(session, alliance_id, game_account_id)


@alliance_controller.delete(
    "/{alliance_id}/visitors/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def leave_as_visitor(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Leave a visited alliance. The current user must be a visitor of it."""
    visitor_account = await AllianceService.get_user_visitor_account(
        session, alliance_id, current_user.id
    )
    await AllianceVisitorService.remove_visitor(session, alliance_id, visitor_account.id)
```

- [ ] **Step 5: Commit**

```bash
git add api/src/controllers/alliance_controller.py
git commit -m "feat(visitor): add visitor endpoints to alliance controller"
```

---

## Task 8: Backend integration tests

**Files:**
- Modify: `api/tests/integration/endpoints/setup/game_setup.py`
- Create: `api/tests/integration/endpoints/test_alliance_visitor.py`

- [ ] **Step 1: Add `push_visitor` helper to game_setup.py**

Add at the bottom of `game_setup.py`:

```python
async def push_visitor(
    alliance: Alliance,
    user_id: uuid.UUID,
    game_pseudo: str = "VisitorPseudo",
) -> GameAccount:
    """Create a game account and add it as a visitor of the alliance."""
    from src.models.AllianceVisitor import AllianceVisitor
    acc = get_game_account(user_id=user_id, game_pseudo=game_pseudo)
    visitor = AllianceVisitor(alliance_id=alliance.id, game_account_id=acc.id)
    await load_objects([acc, visitor])
    return acc
```

- [ ] **Step 2: Write integration tests**

```python
# api/tests/integration/endpoints/test_alliance_visitor.py
"""Integration tests for alliance visitor system."""
import uuid
import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.integration.endpoints.setup.game_setup import (
    push_game_account,
    push_alliance_with_owner,
    push_officer,
    push_visitor,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_delete_request,
)
from tests.utils.utils_constant import (
    USER_ID, USER2_ID, USER2_LOGIN, USER2_EMAIL, DISCORD_ID_2,
    GAME_PSEUDO, GAME_PSEUDO_2, ALLIANCE_NAME, ALLIANCE_TAG,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))
USER3_ID = uuid.uuid4()
HEADERS_USER3 = create_auth_headers(user_id=str(USER3_ID))

ENDPOINT = "/alliances"


async def _setup_users():
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    from tests.integration.endpoints.setup.user_setup import get_generic_user as gu
    u3 = gu(login="user3", email="user3@test.com")
    u3.id = USER3_ID
    await load_objects([u1, u2, u3])


class TestInviteVisitor:
    @pytest.mark.asyncio
    async def test_officer_can_invite_visitor(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "visitor"
        assert body["status"] == "pending"

    @pytest.mark.asyncio
    async def test_cannot_invite_visitor_when_max_reached(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        # Create 10 visitors
        from src.models.AllianceVisitor import AllianceVisitor
        from src.models.GameAccount import GameAccount
        from tests.integration.endpoints.setup.user_setup import get_generic_user
        visitors = []
        for i in range(10):
            uid = uuid.uuid4()
            u = get_generic_user(login=f"v{i}", email=f"v{i}@test.com")
            u.id = uid
            acc = GameAccount(user_id=uid, game_pseudo=f"visitor{i}")
            v = AllianceVisitor(alliance_id=alliance.id, game_account_id=acc.id)
            visitors.extend([u, acc, v])
        await load_objects(visitors)

        new_acc = await push_game_account(user_id=USER2_ID, game_pseudo="newvisitor")
        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(new_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_random_user_cannot_invite_visitor(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        outsider_acc = await push_game_account(user_id=USER3_ID, game_pseudo="outsider")

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER3,
        )
        assert response.status_code == 403


class TestAcceptVisitorInvitation:
    @pytest.mark.asyncio
    async def test_accept_visitor_invitation_creates_visitor_record(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        invite_resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        inv_id = invite_resp.json()["id"]

        accept_resp = await execute_post_request(
            f"{ENDPOINT}/invitations/{inv_id}/accept",
            {},
            headers=HEADERS_USER2,
        )
        assert accept_resp.status_code == 200
        assert accept_resp.json()["status"] == "accepted"

        # Visitor should appear in visitors list
        visitors_resp = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/visitors",
            headers=HEADERS_USER1,
        )
        assert visitors_resp.status_code == 200
        visitor_ids = [v["game_account_id"] for v in visitors_resp.json()]
        assert str(visitor_acc.id) in visitor_ids

    @pytest.mark.asyncio
    async def test_visitor_game_account_alliance_id_unchanged(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        invite_resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        inv_id = invite_resp.json()["id"]
        await execute_post_request(f"{ENDPOINT}/invitations/{inv_id}/accept", {}, headers=HEADERS_USER2)

        # game account should NOT have alliance_id set
        from tests.utils.utils_db import get_test_session
        from src.models.GameAccount import GameAccount as GA
        from sqlmodel import select
        async for session in get_test_session():
            result = await session.exec(select(GA).where(GA.id == visitor_acc.id))
            acc = result.first()
            assert acc.alliance_id is None


class TestVisitorPermissions:
    @pytest.mark.asyncio
    async def test_visitor_cannot_access_visitor_list(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/visitors",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_visitor_cannot_invite_members(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        outsider_acc = await push_game_account(user_id=USER3_ID, game_pseudo="outsider")

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(outsider_acc.id), "type": "member"},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


class TestKickVisitor:
    @pytest.mark.asyncio
    async def test_officer_can_kick_visitor(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/visitors/{visitor_acc.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 204

        visitors_resp = await execute_get_request(f"{ENDPOINT}/{alliance.id}/visitors", headers=HEADERS_USER1)
        assert visitors_resp.json() == []

    @pytest.mark.asyncio
    async def test_visitor_can_leave(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/visitors/me",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 204


class TestVisitorConvertToMember:
    @pytest.mark.asyncio
    async def test_accepting_member_invitation_removes_visitor_record(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        # Officer sends member invitation
        invite_resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "member"},
            headers=HEADERS_USER1,
        )
        assert invite_resp.status_code == 201
        inv_id = invite_resp.json()["id"]

        # Visitor accepts
        accept_resp = await execute_post_request(
            f"{ENDPOINT}/invitations/{inv_id}/accept",
            {},
            headers=HEADERS_USER2,
        )
        assert accept_resp.status_code == 200

        # Should no longer be a visitor
        visitors_resp = await execute_get_request(f"{ENDPOINT}/{alliance.id}/visitors", headers=HEADERS_USER1)
        visitor_ids = [v["game_account_id"] for v in visitors_resp.json()]
        assert str(visitor_acc.id) not in visitor_ids
```

- [ ] **Step 3: Run the tests**

```bash
cd api && uv run pytest tests/integration/endpoints/test_alliance_visitor.py -v
```

Expected: all PASS

- [ ] **Step 4: Run full backend test suite**

```bash
cd api && uv run pytest tests/ -v --tb=short
```

Expected: no regressions, new tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/tests/integration/endpoints/test_alliance_visitor.py api/tests/integration/endpoints/setup/game_setup.py
git commit -m "test(visitor): integration tests for visitor lifecycle and permissions"
```

---

## Task 9: Frontend services

**Files:**
- Modify: `front/app/services/game.ts`

- [ ] **Step 1: Add types and API calls**

Add after the `AllianceOfficer` interface:

```typescript
export interface AllianceVisitor {
  id: string;
  alliance_id: string;
  game_account_id: string;
  game_pseudo: string;
  visited_since: string;
}

export interface AllianceInvitation {
  id: string;
  alliance_id: string;
  alliance_name: string;
  alliance_tag: string;
  game_account_id: string;
  game_account_pseudo: string;
  invited_by_game_account_id: string;
  invited_by_pseudo: string;
  status: 'pending' | 'accepted' | 'declined';
  type: 'member' | 'visitor';
  created_at: string;
  responded_at: string | null;
}
```

Add service functions after `getMyAlliances`:

```typescript
export async function getMyVisitedAlliances(): Promise<Alliance[]> {
  const response = await debugFetch(`${PROXY}/alliances/my-visited`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des alliances visitées');
  return response.json();
}

export async function getAllianceVisitors(allianceId: string): Promise<AllianceVisitor[]> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/visitors`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des visiteurs');
  return response.json();
}

export async function kickVisitor(allianceId: string, gameAccountId: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/visitors/${gameAccountId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la suppression du visiteur');
}

export async function leaveAsVisitor(allianceId: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/visitors/me`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la sortie de l\'alliance visitée');
}

export async function inviteVisitor(allianceId: string, gameAccountId: string): Promise<AllianceInvitation> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/invitations`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId, type: 'visitor' }),
  });
  await throwOnError(response, 'Erreur lors de l\'invitation du visiteur');
  return response.json();
}

export async function inviteMember(allianceId: string, gameAccountId: string): Promise<AllianceInvitation> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/invitations`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId, type: 'member' }),
  });
  await throwOnError(response, 'Erreur lors de l\'invitation du membre');
  return response.json();
}
```

Also update the existing `inviteMember` function to accept a type parameter (or keep it for backwards compat and just add `inviteVisitor` separately as above).

- [ ] **Step 2: Run TypeScript build to catch type errors**

```bash
cd front && npm run build 2>&1 | head -50
```

Expected: no new type errors related to the new types.

- [ ] **Step 3: Commit**

```bash
git add front/app/services/game.ts
git commit -m "feat(visitor): add visitor API service functions"
```

---

## Task 10: Alliance selector + war context

**Files:**
- Modify: `front/hooks/use-alliance-selector.ts`
- Modify: `front/app/contexts/war-context.tsx`

- [ ] **Step 1: Update `use-alliance-selector` to include visited alliances**

```typescript
// front/hooks/use-alliance-selector.ts
import { useCallback, useEffect, useState } from 'react';
import { type Alliance, getMyAlliances, getMyVisitedAlliances } from '@/app/services/game';

export interface AllianceWithVisitorFlag extends Alliance {
  isVisitor: boolean;
}

export interface UseAllianceSelectorOptions {
  initialAllianceId?: string;
  initialBg?: number;
}

export interface UseAllianceSelectorReturn {
  alliances: AllianceWithVisitorFlag[];
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

  const [alliances, setAlliances] = useState<AllianceWithVisitorFlag[]>([]);
  const [selectedAllianceId, setSelectedAllianceId] = useState<string>(initialAllianceId);
  const [selectedBg, setSelectedBg] = useState<number>(initialBg);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [member, visited] = await Promise.all([getMyAlliances(), getMyVisitedAlliances()]);
      const memberWithFlag: AllianceWithVisitorFlag[] = member.map((a) => ({ ...a, isVisitor: false }));
      const visitedWithFlag: AllianceWithVisitorFlag[] = visited
        .filter((a) => !member.some((m) => m.id === a.id))
        .map((a) => ({ ...a, isVisitor: true }));
      setAlliances([...memberWithFlag, ...visitedWithFlag]);
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

- [ ] **Step 2: Expose `isVisitor` in war context**

In `front/app/contexts/war-context.tsx`, find the `WarContextValue` interface and add:
```typescript
isVisitor: boolean;
```

Find where `canManageWar` is computed (in the provider body) and add below it:
```typescript
const isVisitor = useMemo(
  () => alliances.find((a) => a.id === selectedAllianceId)?.isVisitor ?? false,
  [alliances, selectedAllianceId]
);
```

Add `isVisitor` to the context value object and to the `useWar()` destructure.

- [ ] **Step 3: Build to catch type errors**

```bash
cd front && npm run build 2>&1 | head -60
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add front/hooks/use-alliance-selector.ts front/app/contexts/war-context.tsx
git commit -m "feat(visitor): merge visited alliances in selector, expose isVisitor in war context"
```

---

## Task 11: War page — visitor UI

**Files:**
- Modify: `front/app/game/war/_components/war-management-bar.tsx`

> Note: The BG picker, mode toggle, and management buttons are all rendered in `war-tab.tsx`. The `canManageWar` flag from context already gates the mode toggle and management buttons. The only new thing needed is the Eye badge on the alliance dropdown and a read-only label for visitors.

- [ ] **Step 1: Add Eye badge to alliance dropdown in war page**

Open `front/app/game/war/_components/war-management-bar.tsx` (or wherever the alliance select/dropdown is rendered — check by searching for `selectedAllianceId` in war components). Add an `Eye` icon next to the alliance name when `isVisitor` is true.

If the alliance selector is rendered inline in `war-tab.tsx`, find the alliance name display and wrap:

```tsx
import { Eye } from 'lucide-react';
// ...
// Where the alliance name/selector is shown:
{isVisitor && <Eye className="w-3.5 h-3.5 text-muted-foreground" title={t.game.war.viewOnly} />}
```

- [ ] **Step 2: Verify `canManageWar` is already false for visitors**

In `war-context.tsx`, `canManageWar` is derived from `useAllianceRole`. Since visitors are not members, `canManageWar` should already be `false`. Verify by reading the `useAllianceRole` hook logic. If it only checks `roles` from `GET /alliances/my-roles` (which only includes member alliances), visitors automatically get `canManageWar = false` — no change needed.

- [ ] **Step 3: Build**

```bash
cd front && npm run build 2>&1 | head -60
```

- [ ] **Step 4: Commit**

```bash
git add front/app/game/war/
git commit -m "feat(visitor): show Eye badge for visited alliances in war dropdown"
```

---

## Task 12: Alliance page — visitors section

**Files:**
- Create: `front/app/game/alliances/_components/alliance-visitors-section.tsx`
- Modify: `front/app/game/alliances/_components/alliances-tab.tsx`

- [ ] **Step 1: Create the visitors section component**

```tsx
// front/app/game/alliances/_components/alliance-visitors-section.tsx
'use client';

import { useState } from 'react';
import { Eye, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import { type AllianceVisitor, kickVisitor, inviteMember } from '@/app/services/game';
import { ConfirmationDialog } from '@/components/confirmation-dialog';

interface AllianceVisitorsSectionProps {
  allianceId: string;
  visitors: AllianceVisitor[];
  canManage: boolean;
  onViewRoster: (gameAccountId: string, pseudo: string) => void;
  onRefresh: () => void;
}

export default function AllianceVisitorsSection({
  allianceId,
  visitors,
  canManage,
  onViewRoster,
  onRefresh,
}: Readonly<AllianceVisitorsSectionProps>) {
  const { t } = useI18n();
  const [kickTarget, setKickTarget] = useState<AllianceVisitor | null>(null);
  const [kicking, setKicking] = useState(false);

  async function handleKickConfirm() {
    if (!kickTarget) return;
    setKicking(true);
    try {
      await kickVisitor(allianceId, kickTarget.game_account_id);
      onRefresh();
    } finally {
      setKicking(false);
      setKickTarget(null);
    }
  }

  async function handleInviteAsMember(visitor: AllianceVisitor) {
    await inviteMember(allianceId, visitor.game_account_id);
    onRefresh();
  }

  if (visitors.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t.game.alliances.visitors} ({visitors.length}/10)
        </h3>
      </div>
      <div className="space-y-1">
        {visitors.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40"
            data-cy={`visitor-row-${v.game_account_id}`}
          >
            <button
              className="text-sm hover:underline text-left"
              onClick={() => onViewRoster(v.game_account_id, v.game_pseudo)}
              data-cy={`visitor-roster-${v.game_account_id}`}
            >
              {v.game_pseudo}
            </button>
            {canManage && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleInviteAsMember(v)}
                  data-cy={`invite-visitor-as-member-${v.game_account_id}`}
                  title={t.game.alliances.inviteAsMember}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setKickTarget(v)}
                  data-cy={`kick-visitor-${v.game_account_id}`}
                  title={t.game.alliances.kickVisitor}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmationDialog
        open={!!kickTarget}
        onOpenChange={(open) => { if (!open) setKickTarget(null); }}
        onConfirm={handleKickConfirm}
        loading={kicking}
        description={t.game.alliances.kickVisitorConfirm}
        data-cy="confirmation-dialog-confirm"
      />
    </div>
  );
}
```

> Note: `inviteMember` is a separate function — check `game.ts` for the exact name. Also verify `ConfirmationDialog` import path matches what other components use (search for `ConfirmationDialog` in the codebase with `grep -r "ConfirmationDialog" front/app --include="*.tsx" -l`).

- [ ] **Step 2: Add visitors section to alliances-tab**

Open `front/app/game/alliances/_components/alliances-tab.tsx`. Find where members/officers are rendered for an alliance and add after:

```tsx
import AllianceVisitorsSection from './alliance-visitors-section';
// ...
// After the members list, add:
<AllianceVisitorsSection
  allianceId={selectedAllianceId}
  visitors={visitors}  // fetched via getAllianceVisitors in the viewmodel
  canManage={canManage}
  onViewRoster={onViewRoster}
  onRefresh={onRefresh}
/>
```

You will need to:
1. Add `visitors` state to the alliances viewmodel (`use-alliances-viewmodel.ts`)
2. Fetch visitors via `getAllianceVisitors(allianceId)` when the selected alliance changes
3. Pass visitors down through `AlliancesTab` props

- [ ] **Step 3: Build**

```bash
cd front && npm run build 2>&1 | head -80
```

Fix any TypeScript errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add front/app/game/alliances/
git commit -m "feat(visitor): add visitors section to alliance page"
```

---

## Task 13: Invitations section — visitor badge + i18n keys

**Files:**
- Modify: `front/app/game/alliances/_components/invitations-section.tsx`
- Modify: `front/app/i18n/locales/en.ts`
- Modify: `front/app/i18n/locales/fr.ts`

- [ ] **Step 1: Add i18n keys to en.ts**

Find the `game.alliances` section and add:
```typescript
visitors: 'Visitors',
inviteAsMember: 'Invite as member',
kickVisitor: 'Remove visitor',
kickVisitorConfirm: 'Are you sure you want to remove this visitor from the alliance?',
visitorBadge: 'Visitor',
invitationTypeVisitor: 'Visitor invitation',
```

Find the `game.war` section and add:
```typescript
viewOnly: 'View only',
```

- [ ] **Step 2: Add i18n keys to fr.ts**

Same keys in French:
```typescript
visitors: 'Visiteurs',
inviteAsMember: 'Inviter comme membre',
kickVisitor: 'Retirer le visiteur',
kickVisitorConfirm: 'Êtes-vous sûr de vouloir retirer ce visiteur de l\'alliance ?',
visitorBadge: 'Visiteur',
invitationTypeVisitor: 'Invitation visiteur',
```

```typescript
viewOnly: 'Lecture seule',
```

- [ ] **Step 3: Add visitor badge to invitations section**

In `front/app/game/alliances/_components/invitations-section.tsx`, find where invitation cards are rendered. Add a badge when `invitation.type === 'visitor'`:

```tsx
import { Eye } from 'lucide-react';
// ...
// Inside the invitation card render:
{invitation.type === 'visitor' && (
  <span
    className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
    data-cy={`visitor-badge-${invitation.id}`}
  >
    <Eye className="w-3 h-3" />
    {t.game.alliances.visitorBadge}
  </span>
)}
```

Also update the `AllianceInvitation` type import if the type is defined locally — add `type: 'member' | 'visitor'` to it, or import from `game.ts`.

- [ ] **Step 4: Build**

```bash
cd front && npm run build 2>&1 | head -80
```

Expected: clean build.

- [ ] **Step 5: Run i18n check**

```
/i18n-check
```

Expected: no missing keys.

- [ ] **Step 6: Commit**

```bash
git add front/app/i18n/ front/app/game/alliances/_components/invitations-section.tsx
git commit -m "feat(visitor): visitor badge in invitations, i18n keys"
```

---

## Task 14: E2E Cypress tests

**Files:**
- Modify: `front/cypress/support/e2e.ts` (add `setupVisitorScenario`)
- Create: `front/cypress/e2e/alliances/visitor.cy.ts`

- [ ] **Step 1: Add `setupVisitorScenario` helper**

In the E2E support file, add:

```typescript
export function setupVisitorScenario(prefix: string) {
  let adminToken: string;
  let ownerData: { access_token: string; game_account_id: string };
  let visitorData: { access_token: string; game_account_id: string };
  let allianceId: string;

  cy.setupAdmin('admin-token').then((token) => {
    adminToken = token;
    return cy.setupAllianceOwner(prefix, `${prefix}owner`, `${prefix}Alliance`, `${prefix}TAG`);
  }).then((owner) => {
    ownerData = owner;
    allianceId = owner.allianceId;
    return cy.setupUser(`${prefix}-visitor-token`);
  }).then((visitor) => {
    visitorData = visitor;
    // Send visitor invitation
    return cy.request({
      method: 'POST',
      url: `/api/back/alliances/${allianceId}/invitations`,
      headers: { Authorization: `Bearer ${ownerData.access_token}` },
      body: { game_account_id: visitorData.game_account_id, type: 'visitor' },
    });
  }).then((inviteResp) => {
    const invId = inviteResp.body.id;
    return cy.request({
      method: 'POST',
      url: `/api/back/alliances/invitations/${invId}/accept`,
      headers: { Authorization: `Bearer ${visitorData.access_token}` },
      body: {},
    });
  });

  return cy.wrap({ adminToken, ownerData, visitorData, allianceId });
}
```

> Adapt to match the exact `setupUser`/`setupAllianceOwner` signatures already in `e2e.ts`.

- [ ] **Step 2: Write Cypress tests**

```typescript
// front/cypress/e2e/alliances/visitor.cy.ts
describe('Visitor system', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('visitor sees visited alliance in war dropdown with Eye icon', () => {
    // setup visitor scenario
    // login as visitor, navigate to war page
    // assert Eye icon present next to alliance name
    cy.getByCy('war-alliance-selector').within(() => {
      cy.getByCy('visitor-eye-icon').should('exist');
    });
  });

  it('visitor cannot see management buttons in war page', () => {
    // login as visitor, navigate to war
    cy.getByCy('war-mode-toggle').should('not.exist');
    cy.getByCy('end-war-btn').should('not.exist');
    cy.getByCy('clear-war-bg-btn').should('not.exist');
  });

  it('officer can kick visitor with confirmation dialog', () => {
    // login as officer, navigate to alliances page
    // click kick button next to visitor
    cy.getByCy('kick-visitor-VISITOR_ACCOUNT_ID').click();
    cy.getByCy('confirmation-dialog-confirm').click();
    // visitor row should disappear
    cy.getByCy('visitor-row-VISITOR_ACCOUNT_ID').should('not.exist');
  });

  it('officer can send member invitation to visitor', () => {
    // login as officer, navigate to alliances page
    // click "invite as member" button next to visitor
    cy.getByCy('invite-visitor-as-member-VISITOR_ACCOUNT_ID').click();
    // invitation should appear in visitor's pending invitations with type=member
  });
});
```

> Fill in the actual test bodies using the `setupVisitorScenario` helper and following the E2E patterns from other specs (see `front/cypress/e2e/` for examples).

- [ ] **Step 3: Run E2E tests**

Use skill: `/test-e2e` with `spec_files=["alliances/visitor.cy.ts"]`

- [ ] **Step 4: Commit**

```bash
git add front/cypress/
git commit -m "test(visitor): E2E tests for visitor system"
```

---

## Task 15: Lint + final check

- [ ] **Step 1: Lint backend**

```bash
cd api && uvx ruff check src/ && uvx ruff format src/
```

Fix any issues.

- [ ] **Step 2: Full backend test suite**

```bash
cd api && uv run pytest tests/ -v --tb=short 2>&1 | tail -30
```

Expected: all green.

- [ ] **Step 3: Frontend build**

```bash
cd front && npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 4: Final commit**

```bash
git add -u
git commit -m "feat(visitor): lint and final cleanup"
```
