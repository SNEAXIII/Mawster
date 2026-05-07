# War Fight Record Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Snapshot all fight data (attacker, defender, synergies, prefights) into immutable records when a war is ended, and expose a global knowledge base endpoint.

**Architecture:** Three new SQLModel tables (`WarFightRecord`, `WarFightSynergy`, `WarFightPrefight`) are populated as a side-effect of `WarService.end_war`. A new `FightRecordService` handles both snapshot creation and knowledge base queries. A new top-level `GET /fight-records` endpoint returns records to any logged-in alliance member.

**Tech Stack:** FastAPI, SQLModel, SQLAlchemy async, MariaDB, Alembic, pytest-asyncio

---

## File Map

| Action | Path |
|---|---|
| Create | `api/src/models/WarFightRecord.py` |
| Create | `api/src/models/WarFightSynergy.py` |
| Create | `api/src/models/WarFightPrefight.py` |
| Modify | `api/src/models/__init__.py` |
| Create | `api/src/dto/dto_fight_record.py` |
| Create | `api/src/services/FightRecordService.py` |
| Modify | `api/src/services/WarService.py` (end_war only) |
| Create | `api/src/controllers/fight_record_controller.py` |
| Modify | `api/src/controllers/__init__.py` |
| Create | `api/tests/integration/endpoints/test_war_fight_record.py` |

---

### Task 1: Create the three new models

**Files:**
- Create: `api/src/models/WarFightRecord.py`
- Create: `api/src/models/WarFightSynergy.py`
- Create: `api/src/models/WarFightPrefight.py`
- Modify: `api/src/models/__init__.py`

- [ ] **Step 1: Create `WarFightRecord.py`**

```python
# api/src/models/WarFightRecord.py
import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.Champion import Champion
    from src.models.GameAccount import GameAccount
    from src.models.Season import Season
    from src.models.War import War
    from src.models.WarFightPrefight import WarFightPrefight
    from src.models.WarFightSynergy import WarFightSynergy


class WarFightRecord(SQLModel, table=True):
    __tablename__ = "war_fight_record"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_id: uuid.UUID = Field(foreign_key="war.id")
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    season_id: Optional[uuid.UUID] = Field(default=None, foreign_key="season.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    battlegroup: int = Field(ge=1, le=3)
    node_number: int = Field(ge=1, le=50)
    tier: int
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: int
    rank: int
    ascension: int
    is_saga_attacker: bool
    defender_champion_id: uuid.UUID = Field(foreign_key="champion.id")
    defender_stars: int
    defender_rank: int
    defender_ascension: int
    defender_is_saga_defender: bool
    ko_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)

    war: "War" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.war_id]"}
    )
    alliance: "Alliance" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.alliance_id]"}
    )
    season: Optional["Season"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.season_id]"}
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.game_account_id]"}
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.champion_id]"}
    )
    defender_champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.defender_champion_id]"}
    )
    synergies: List["WarFightSynergy"] = Relationship(back_populates="fight_record")
    prefights: List["WarFightPrefight"] = Relationship(back_populates="fight_record")
```

- [ ] **Step 2: Create `WarFightSynergy.py`**

```python
# api/src/models/WarFightSynergy.py
import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.WarFightRecord import WarFightRecord


class WarFightSynergy(SQLModel, table=True):
    __tablename__ = "war_fight_synergy"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_fight_record_id: uuid.UUID = Field(foreign_key="war_fight_record.id")
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: int
    ascension: int

    fight_record: "WarFightRecord" = Relationship(
        back_populates="synergies",
        sa_relationship_kwargs={"foreign_keys": "[WarFightSynergy.war_fight_record_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightSynergy.champion_id]"}
    )
```

- [ ] **Step 3: Create `WarFightPrefight.py`**

```python
# api/src/models/WarFightPrefight.py
import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.WarFightRecord import WarFightRecord


class WarFightPrefight(SQLModel, table=True):
    __tablename__ = "war_fight_prefight"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_fight_record_id: uuid.UUID = Field(foreign_key="war_fight_record.id")
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: int
    ascension: int

    fight_record: "WarFightRecord" = Relationship(
        back_populates="prefights",
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.war_fight_record_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.champion_id]"}
    )
```

- [ ] **Step 4: Register models in `api/src/models/__init__.py`**

Add these three lines after the existing `WarPrefightAttacker` import:

```python
from src.models.WarFightRecord import WarFightRecord  # noqa: F401
from src.models.WarFightSynergy import WarFightSynergy  # noqa: F401
from src.models.WarFightPrefight import WarFightPrefight  # noqa: F401
```

- [ ] **Step 5: Commit**

```bash
git add api/src/models/WarFightRecord.py api/src/models/WarFightSynergy.py api/src/models/WarFightPrefight.py api/src/models/__init__.py
git commit -m "feat: add WarFightRecord, WarFightSynergy, WarFightPrefight models"
```

---

### Task 2: Migration

**Files:** `api/migrations/versions/<hash>_add_war_fight_record.py` (auto-generated)

- [ ] **Step 1: Reset DB and generate migration**

```bash
cd api && make reset-db
make create-mig MESSAGE="add_war_fight_record"
```

Expected: new file created under `api/migrations/versions/` containing `op.create_table('war_fight_record', ...)`, `op.create_table('war_fight_synergy', ...)`, `op.create_table('war_fight_prefight', ...)`.

- [ ] **Step 2: Apply migration**

```bash
make migrate
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade ... -> ..., add_war_fight_record`

- [ ] **Step 3: Commit**

```bash
git add api/migrations/
git commit -m "feat: migration add_war_fight_record"
```

---

### Task 3: DTOs

**Files:**
- Create: `api/src/dto/dto_fight_record.py`

- [ ] **Step 1: Write the failing DTO test**

```python
# api/tests/unit/dto/test_dto_fight_record.py
import uuid
from unittest.mock import MagicMock
from src.dto.dto_fight_record import (
    WarFightRecordResponse,
    WarFightSynergyResponse,
    WarFightPrefightResponse,
)


def _make_champion(name="Wolverine", champion_class="Mutant", image_url=None):
    c = MagicMock()
    c.name = name
    c.champion_class = champion_class
    c.image_url = image_url
    return c


def test_synergy_response_flattens_champion():
    syn = MagicMock()
    syn.champion_id = uuid.uuid4()
    syn.champion = _make_champion("Wolverine", "Mutant")
    syn.stars = 6
    syn.ascension = 1

    result = WarFightSynergyResponse.model_validate(syn)
    assert result.champion_name == "Wolverine"
    assert result.champion_class == "Mutant"
    assert result.stars == 6


def test_prefight_response_flattens_champion():
    pf = MagicMock()
    pf.champion_id = uuid.uuid4()
    pf.champion = _make_champion("Magneto", "Mutant")
    pf.stars = 7
    pf.ascension = 0

    result = WarFightPrefightResponse.model_validate(pf)
    assert result.champion_name == "Magneto"
    assert result.stars == 7


def test_fight_record_response_flattens_all():
    record = MagicMock()
    record.id = uuid.uuid4()
    record.war_id = uuid.uuid4()
    record.alliance_id = uuid.uuid4()
    record.season_id = None
    record.game_account.game_pseudo = "PlayerOne"
    record.battlegroup = 1
    record.node_number = 10
    record.tier = 5
    record.champion_id = uuid.uuid4()
    record.champion = _make_champion("Spider-Man", "Science")
    record.stars = 7
    record.rank = 5
    record.ascension = 1
    record.is_saga_attacker = True
    record.defender_champion_id = uuid.uuid4()
    record.defender_champion = _make_champion("Thanos", "Cosmic")
    record.defender_stars = 6
    record.defender_rank = 3
    record.defender_ascension = 0
    record.defender_is_saga_defender = False
    record.ko_count = 2
    record.synergies = []
    record.prefights = []
    from datetime import datetime
    record.created_at = datetime.now()

    result = WarFightRecordResponse.model_validate(record)
    assert result.game_account_pseudo == "PlayerOne"
    assert result.champion_name == "Spider-Man"
    assert result.defender_champion_name == "Thanos"
    assert result.tier == 5
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest api/tests/unit/dto/test_dto_fight_record.py -v
```

Expected: `ImportError` — `dto_fight_record` not found.

- [ ] **Step 3: Create `api/src/dto/dto_fight_record.py`**

```python
# api/src/dto/dto_fight_record.py
import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, model_validator


class WarFightSynergyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    stars: int
    ascension: int

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
            "stars": data.stars,
            "ascension": data.ascension,
        }


class WarFightPrefightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    stars: int
    ascension: int

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
            "stars": data.stars,
            "ascension": data.ascension,
        }


class WarFightRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    alliance_id: uuid.UUID
    season_id: Optional[uuid.UUID] = None
    game_account_pseudo: str
    battlegroup: int
    node_number: int
    tier: int
    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    stars: int
    rank: int
    ascension: int
    is_saga_attacker: bool
    defender_champion_id: uuid.UUID
    defender_champion_name: str
    defender_champion_class: str
    defender_image_url: Optional[str] = None
    defender_stars: int
    defender_rank: int
    defender_ascension: int
    defender_is_saga_defender: bool
    ko_count: int
    synergies: List[WarFightSynergyResponse] = []
    prefights: List[WarFightPrefightResponse] = []
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "war_id": data.war_id,
            "alliance_id": data.alliance_id,
            "season_id": data.season_id,
            "game_account_pseudo": data.game_account.game_pseudo,
            "battlegroup": data.battlegroup,
            "node_number": data.node_number,
            "tier": data.tier,
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "image_url": data.champion.image_url,
            "stars": data.stars,
            "rank": data.rank,
            "ascension": data.ascension,
            "is_saga_attacker": data.is_saga_attacker,
            "defender_champion_id": data.defender_champion_id,
            "defender_champion_name": data.defender_champion.name,
            "defender_champion_class": data.defender_champion.champion_class,
            "defender_image_url": data.defender_champion.image_url,
            "defender_stars": data.defender_stars,
            "defender_rank": data.defender_rank,
            "defender_ascension": data.defender_ascension,
            "defender_is_saga_defender": data.defender_is_saga_defender,
            "ko_count": data.ko_count,
            "synergies": data.synergies,
            "prefights": data.prefights,
            "created_at": data.created_at,
        }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest api/tests/unit/dto/test_dto_fight_record.py -v
```

Expected: 3 PASSED.

- [ ] **Step 5: Commit**

```bash
git add api/src/dto/dto_fight_record.py api/tests/unit/dto/test_dto_fight_record.py
git commit -m "feat: add WarFightRecordResponse DTOs"
```

---

### Task 4: FightRecordService — snapshot logic

**Files:**
- Create: `api/src/services/FightRecordService.py`

- [ ] **Step 1: Write the failing integration test for snapshot**

```python
# api/tests/integration/endpoints/test_war_fight_record.py
"""Integration tests for war fight record snapshot and knowledge base."""

import uuid
import pytest

from tests.utils.utils_client import create_auth_headers, execute_post_request, execute_patch_request
from tests.utils.utils_constant import USER_ID, USER2_ID, GAME_PSEUDO, GAME_PSEUDO_2, ALLIANCE_NAME, ALLIANCE_TAG
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner, push_member, push_officer, push_champion, push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_db import load_objects
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightRecord import WarFightRecord
from sqlmodel import select

OPPONENT = "Enemy Alliance"


async def _setup_war_with_fight():
    """Alliance + war + node 10 BG1 with defender and attacker assigned."""
    from tests.utils.utils_db import load_objects
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()

    alliance, owner = await push_alliance_with_owner(
        user_id=USER_ID, game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME, alliance_tag=ALLIANCE_TAG,
    )
    await push_officer(alliance, owner)
    member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    headers_owner = create_auth_headers(user_id=str(USER_ID))

    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{owner.id}/group",
        payload={"group": 1}, headers=headers_owner,
    )
    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{member.id}/group",
        payload={"group": 1}, headers=headers_owner,
    )

    from src.models.Champion import Champion
    from src.models.ChampionUser import ChampionUser
    defender_champ = Champion(name="Thanos", champion_class="Cosmic")
    attacker_champ = Champion(name="Spider-Man", champion_class="Science", is_saga_attacker=True)
    attacker_cu = ChampionUser(
        game_account_id=member.id, champion_id=attacker_champ.id,
        stars=7, rank=4, ascension=0,
    )
    await load_objects([defender_champ, attacker_champ, attacker_cu])

    war = War(
        id=uuid.uuid4(), alliance_id=alliance.id,
        opponent_name=OPPONENT, created_by_id=owner.id,
    )
    placement = WarDefensePlacement(
        war_id=war.id, battlegroup=1, node_number=10,
        champion_id=defender_champ.id, stars=6, rank=3, ascension=0,
        attacker_champion_user_id=attacker_cu.id,
        ko_count=1, is_combat_completed=False,
    )
    await load_objects([war, placement])

    return {
        "alliance": alliance, "owner": owner, "member": member,
        "war": war, "placement": placement, "attacker_cu": attacker_cu,
        "attacker_champ": attacker_champ, "defender_champ": defender_champ,
    }


class TestWarFightRecordSnapshot:
    @pytest.mark.asyncio
    async def test_end_war_creates_fight_record(self, db_session):
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers,
        )
        assert response.status_code == 200

        records = (await db_session.exec(
            select(WarFightRecord).where(WarFightRecord.war_id == data["war"].id)
        )).all()
        assert len(records) == 1
        r = records[0]
        assert r.node_number == 10
        assert r.battlegroup == 1
        assert r.champion_id == data["attacker_champ"].id
        assert r.stars == 7
        assert r.rank == 4
        assert r.is_saga_attacker is True
        assert r.defender_champion_id == data["defender_champ"].id
        assert r.defender_stars == 6
        assert r.ko_count == 1
        assert r.alliance_id == data["alliance"].id

    @pytest.mark.asyncio
    async def test_end_war_skips_node_without_attacker(self, db_session):
        """Nodes without an attacker assigned must not produce a fight record."""
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, owner = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME, alliance_tag=ALLIANCE_TAG,
        )
        await push_officer(alliance, owner)
        defender_champ = await push_champion(name="Hulk", champion_class="Science")
        war = War(
            id=uuid.uuid4(), alliance_id=alliance.id,
            opponent_name=OPPONENT, created_by_id=owner.id,
        )
        placement = WarDefensePlacement(
            war_id=war.id, battlegroup=1, node_number=5,
            champion_id=defender_champ.id, stars=6, rank=3, ascension=0,
        )
        await load_objects([war, placement])

        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/end",
            payload={"win": False, "elo_change": None},
            headers=headers,
        )
        assert response.status_code == 200

        records = (await db_session.exec(
            select(WarFightRecord).where(WarFightRecord.war_id == war.id)
        )).all()
        assert len(records) == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest api/tests/integration/endpoints/test_war_fight_record.py::TestWarFightRecordSnapshot -v
```

Expected: FAIL — `WarFightRecord` table doesn't exist yet (or snapshot not implemented).

- [ ] **Step 3: Create `api/src/services/FightRecordService.py`**

```python
# api/src/services/FightRecordService.py
import uuid
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import and_, select
from starlette import status

from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightPrefight import WarFightPrefight
from src.models.WarFightRecord import WarFightRecord
from src.models.WarFightSynergy import WarFightSynergy
from src.models.WarPrefightAttacker import WarPrefightAttacker
from src.models.WarSynergyAttacker import WarSynergyAttacker
from src.utils.db import SessionDep


class FightRecordService:

    @classmethod
    async def snapshot_war(cls, session: SessionDep, war: War) -> None:
        stmt = (
            select(WarDefensePlacement)
            .where(
                and_(
                    WarDefensePlacement.war_id == war.id,
                    WarDefensePlacement.attacker_champion_user_id.isnot(None),
                )
            )
            .options(
                selectinload(WarDefensePlacement.attacker_champion_user).selectinload(
                    ChampionUser.champion
                ),
                selectinload(WarDefensePlacement.champion),
            )
        )
        result = await session.exec(stmt)
        placements = result.all()

        for placement in placements:
            attacker_cu: ChampionUser = placement.attacker_champion_user
            attacker_champ: Champion = attacker_cu.champion
            defender_champ: Champion = placement.champion

            record = WarFightRecord(
                war_id=war.id,
                alliance_id=war.alliance_id,
                season_id=war.season_id,
                game_account_id=attacker_cu.game_account_id,
                battlegroup=placement.battlegroup,
                node_number=placement.node_number,
                tier=war.tier,
                champion_id=attacker_champ.id,
                stars=attacker_cu.stars,
                rank=attacker_cu.rank,
                ascension=attacker_cu.ascension,
                is_saga_attacker=attacker_champ.is_saga_attacker,
                defender_champion_id=defender_champ.id,
                defender_stars=placement.stars,
                defender_rank=placement.rank,
                defender_ascension=placement.ascension,
                defender_is_saga_defender=defender_champ.is_saga_defender,
                ko_count=placement.ko_count,
            )
            session.add(record)
            await session.flush()

            pf_stmt = (
                select(WarPrefightAttacker)
                .where(
                    and_(
                        WarPrefightAttacker.war_id == war.id,
                        WarPrefightAttacker.battlegroup == placement.battlegroup,
                        WarPrefightAttacker.target_node_number == placement.node_number,
                    )
                )
                .options(
                    selectinload(WarPrefightAttacker.champion_user)
                )
            )
            pf_result = await session.exec(pf_stmt)
            for pf in pf_result.all():
                pf_cu: ChampionUser = pf.champion_user
                session.add(WarFightPrefight(
                    war_fight_record_id=record.id,
                    champion_id=pf_cu.champion_id,
                    stars=pf_cu.stars,
                    ascension=pf_cu.ascension,
                ))

            syn_stmt = (
                select(WarSynergyAttacker)
                .where(
                    and_(
                        WarSynergyAttacker.war_id == war.id,
                        WarSynergyAttacker.battlegroup == placement.battlegroup,
                        WarSynergyAttacker.target_champion_user_id
                        == placement.attacker_champion_user_id,
                    )
                )
                .options(
                    selectinload(WarSynergyAttacker.champion_user)
                )
            )
            syn_result = await session.exec(syn_stmt)
            for syn in syn_result.all():
                syn_cu: ChampionUser = syn.champion_user
                session.add(WarFightSynergy(
                    war_fight_record_id=record.id,
                    champion_id=syn_cu.champion_id,
                    stars=syn_cu.stars,
                    ascension=syn_cu.ascension,
                ))

        await session.commit()

    @classmethod
    async def assert_user_in_alliance(cls, session: SessionDep, user_id: uuid.UUID) -> None:
        result = await session.exec(
            select(GameAccount).where(
                and_(
                    GameAccount.user_id == user_id,
                    GameAccount.alliance_id.isnot(None),
                )
            )
        )
        if result.first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must belong to an alliance",
            )

    @classmethod
    async def get_fight_records(
        cls,
        session: SessionDep,
        champion_id: Optional[uuid.UUID] = None,
        defender_champion_id: Optional[uuid.UUID] = None,
        node_number: Optional[int] = None,
        tier: Optional[int] = None,
        season_id: Optional[uuid.UUID] = None,
        alliance_id: Optional[uuid.UUID] = None,
        battlegroup: Optional[int] = None,
    ) -> list[WarFightRecord]:
        stmt = (
            select(WarFightRecord)
            .options(
                selectinload(WarFightRecord.champion),
                selectinload(WarFightRecord.defender_champion),
                selectinload(WarFightRecord.game_account),
                selectinload(WarFightRecord.synergies).selectinload(WarFightSynergy.champion),
                selectinload(WarFightRecord.prefights).selectinload(WarFightPrefight.champion),
            )
        )
        if champion_id is not None:
            stmt = stmt.where(WarFightRecord.champion_id == champion_id)
        if defender_champion_id is not None:
            stmt = stmt.where(WarFightRecord.defender_champion_id == defender_champion_id)
        if node_number is not None:
            stmt = stmt.where(WarFightRecord.node_number == node_number)
        if tier is not None:
            stmt = stmt.where(WarFightRecord.tier == tier)
        if season_id is not None:
            stmt = stmt.where(WarFightRecord.season_id == season_id)
        if alliance_id is not None:
            stmt = stmt.where(WarFightRecord.alliance_id == alliance_id)
        if battlegroup is not None:
            stmt = stmt.where(WarFightRecord.battlegroup == battlegroup)

        result = await session.exec(stmt)
        return result.all()
```

- [ ] **Step 4: Run snapshot tests**

```bash
uv run pytest api/tests/integration/endpoints/test_war_fight_record.py::TestWarFightRecordSnapshot -v
```

Expected: FAIL — snapshot not wired into `end_war` yet.

- [ ] **Step 5: Commit service**

```bash
git add api/src/services/FightRecordService.py
git commit -m "feat: add FightRecordService with snapshot_war and get_fight_records"
```

---

### Task 5: Wire snapshot into `end_war`

**Files:**
- Modify: `api/src/services/WarService.py`

- [ ] **Step 1: Open `api/src/services/WarService.py` and locate `end_war`**

Find the block that ends with (around line 372-376):
```python
        war.tier = alliance.tier
        session.add(war)
        await session.commit()
        await session.refresh(war)
        return WarResponse.model_validate(await cls._load_war(session, war.id))
```

- [ ] **Step 2: Add snapshot call after commit**

Replace that block with:
```python
        war.tier = alliance.tier
        session.add(war)
        await session.commit()
        await session.refresh(war)
        from src.services.FightRecordService import FightRecordService
        await FightRecordService.snapshot_war(session, war)
        return WarResponse.model_validate(await cls._load_war(session, war.id))
```

- [ ] **Step 3: Run snapshot tests**

```bash
uv run pytest api/tests/integration/endpoints/test_war_fight_record.py::TestWarFightRecordSnapshot -v
```

Expected: 2 PASSED.

- [ ] **Step 4: Commit**

```bash
git add api/src/services/WarService.py
git commit -m "feat: wire FightRecordService.snapshot_war into end_war"
```

---

### Task 6: Controller and registration

**Files:**
- Create: `api/src/controllers/fight_record_controller.py`
- Modify: `api/src/controllers/__init__.py`

- [ ] **Step 1: Create `fight_record_controller.py`**

```python
# api/src/controllers/fight_record_controller.py
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from starlette import status

from src.dto.dto_fight_record import WarFightRecordResponse
from src.models import User
from src.services.AuthService import AuthService
from src.services.FightRecordService import FightRecordService
from src.utils.db import SessionDep

fight_record_controller = APIRouter(
    prefix="/fight-records",
    tags=["FightRecord"],
    dependencies=[Depends(AuthService.is_logged_as_user)],
)


@fight_record_controller.get("", response_model=list[WarFightRecordResponse])
async def list_fight_records(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    champion_id: Optional[uuid.UUID] = Query(None),
    defender_champion_id: Optional[uuid.UUID] = Query(None),
    node_number: Optional[int] = Query(None, ge=1, le=50),
    tier: Optional[int] = Query(None),
    season_id: Optional[uuid.UUID] = Query(None),
    alliance_id: Optional[uuid.UUID] = Query(None),
    battlegroup: Optional[int] = Query(None, ge=1, le=3),
):
    """Global knowledge base of war fights. Requires alliance membership."""
    await FightRecordService.assert_user_in_alliance(session, current_user.id)
    records = await FightRecordService.get_fight_records(
        session, champion_id, defender_champion_id,
        node_number, tier, season_id, alliance_id, battlegroup,
    )
    return [WarFightRecordResponse.model_validate(r) for r in records]
```

- [ ] **Step 2: Register in `api/src/controllers/__init__.py`**

Add import and add to `routers` list:

```python
from src.controllers.fight_record_controller import fight_record_controller
```

Add `fight_record_controller` to the `routers` list after `statistics_controller`.

- [ ] **Step 3: Commit**

```bash
git add api/src/controllers/fight_record_controller.py api/src/controllers/__init__.py
git commit -m "feat: add fight_record_controller GET /fight-records"
```

---

### Task 7: Integration tests for the endpoint

**Files:**
- Modify: `api/tests/integration/endpoints/test_war_fight_record.py`

- [ ] **Step 1: Add endpoint test class to the existing test file**

Append to `api/tests/integration/endpoints/test_war_fight_record.py`:

```python
from tests.utils.utils_client import execute_get_request


class TestListFightRecords:
    @pytest.mark.asyncio
    async def test_returns_fight_records_for_alliance_member(self):
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        # End the war to trigger snapshot
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        response = await execute_get_request("/fight-records", headers=headers_owner)
        assert response.status_code == 200
        records = response.json()
        assert len(records) == 1
        r = records[0]
        assert r["node_number"] == 10
        assert r["champion_name"] == "Spider-Man"
        assert r["defender_champion_name"] == "Thanos"
        assert r["ko_count"] == 1
        assert r["is_saga_attacker"] is True

    @pytest.mark.asyncio
    async def test_filter_by_champion_id_returns_only_matching(self):
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        # Filter by the attacker champion
        response = await execute_get_request(
            f"/fight-records?champion_id={data['attacker_champ'].id}",
            headers=headers_owner,
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

        # Filter by a non-existent champion
        response = await execute_get_request(
            f"/fight-records?champion_id={uuid.uuid4()}",
            headers=headers_owner,
        )
        assert response.status_code == 200
        assert len(response.json()) == 0

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self):
        response = await execute_get_request("/fight-records", headers={})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_user_without_alliance_returns_403(self):
        await load_objects([get_generic_user(is_base_id=True)])
        # User with no alliance
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_get_request("/fight-records", headers=headers)
        assert response.status_code == 403
```

- [ ] **Step 2: Run all fight record tests**

```bash
uv run pytest api/tests/integration/endpoints/test_war_fight_record.py -v
```

Expected: all tests PASS.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
uv run pytest api/tests/ -v --tb=short
```

Expected: all pre-existing tests still pass.

- [ ] **Step 4: Lint**

```bash
cd api && uvx ruff check
uvx ruff format
```

- [ ] **Step 5: Final commit**

```bash
git add api/tests/integration/endpoints/test_war_fight_record.py
git commit -m "test: integration tests for war fight record snapshot and endpoint"
```
