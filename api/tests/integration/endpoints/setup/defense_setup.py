"""Setup helpers for Defense Templates and Defense Plans."""

import uuid
from dataclasses import dataclass

from src.enums.SeasonFormat import SeasonFormat
from src.models.alliance.Alliance import Alliance
from src.models.alliance.DefensePlan import DefenseActivePlan, DefensePlan, DefensePlanNode
from src.models.alliance.DefenseTemplate import DefenseTemplate, DefenseTemplateNode
from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.user.GameAccount import GameAccount
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
    push_member,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_constant import GAME_PSEUDO_2, USER2_ID
from tests.utils.utils_db import load_objects


@dataclass
class DefenseBg:
    """Owner (placement right) and a plain member sharing one Battlegroup."""

    alliance: Alliance
    owner: GameAccount
    member: GameAccount
    spider: Champion
    wolverine: Champion
    iron_man: Champion
    owner_spider: ChampionUser
    owner_wolverine: ChampionUser
    member_spider: ChampionUser
    member_iron_man: ChampionUser


async def setup_defense_bg(battlegroup: int = 1) -> DefenseBg:
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()
    alliance, owner = await push_alliance_with_owner()
    member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
    owner.alliance_group = battlegroup
    member.alliance_group = battlegroup
    await load_objects([owner, member])
    spider = await push_champion(name="Spider-Man", champion_class="Science")
    wolverine = await push_champion(name="Wolverine", champion_class="Mutant")
    iron_man = await push_champion(name="Iron Man", champion_class="Tech")
    return DefenseBg(
        alliance=alliance,
        owner=owner,
        member=member,
        spider=spider,
        wolverine=wolverine,
        iron_man=iron_man,
        owner_spider=await push_champion_user(owner, spider),
        owner_wolverine=await push_champion_user(owner, wolverine, stars=6, rank=5),
        member_spider=await push_champion_user(member, spider, rank=2),
        member_iron_man=await push_champion_user(member, iron_man, rank=1),
    )


async def push_other_alliance() -> Alliance:
    alliance, _ = await push_alliance_with_owner(
        user_id=uuid.uuid4(), game_pseudo="Outsider", alliance_name="Other", alliance_tag="OTH"
    )
    return alliance


async def push_template(
    alliance_id: uuid.UUID,
    fmt: SeasonFormat = SeasonFormat.REGULAR,
    name: str = "Template",
    champions: dict[int, Champion] | None = None,
) -> DefenseTemplate:
    template = DefenseTemplate(alliance_id=alliance_id, format=fmt, name=name)
    nodes = [
        DefenseTemplateNode(template_id=template.id, node_number=node, champion_id=champion.id)
        for node, champion in (champions or {}).items()
    ]
    await load_objects([template, *nodes])
    return template


async def push_plan(
    alliance_id: uuid.UUID,
    battlegroup: int = 1,
    fmt: SeasonFormat = SeasonFormat.REGULAR,
    name: str = "Plan",
    active: bool = False,
) -> DefensePlan:
    plan = DefensePlan(alliance_id=alliance_id, battlegroup=battlegroup, format=fmt, name=name)
    rows: list = [plan]
    if active:
        rows.append(
            DefenseActivePlan(
                alliance_id=alliance_id, battlegroup=battlegroup, format=fmt, plan_id=plan.id
            )
        )
    await load_objects(rows)
    return plan


async def push_plan_node(
    plan: DefensePlan,
    node_number: int,
    champion_user: ChampionUser | None = None,
    champion: Champion | None = None,
) -> DefensePlanNode:
    """Champion only when `champion` is given alone; a Player's copy when `champion_user` is."""
    node = DefensePlanNode(
        plan_id=plan.id,
        node_number=node_number,
        champion_id=champion.id if champion else champion_user.champion_id,
        champion_user_id=champion_user.id if champion_user else None,
    )
    await load_objects([node])
    return node
