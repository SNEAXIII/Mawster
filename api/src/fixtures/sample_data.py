"""
Seed script: 30 users (1 super admin + 1 admin + 28 users), each with 1 game account,
one alliance, and a deterministic roster of 20 champions.

Also seeds: season 66, alliance officers, 3 wars (1 active + 2 ended), war bans,
war defense placements, prefight/synergy attackers, persistent defense placements,
game account masteries, and requested upgrades.

Champion rosters (fully deterministic, no random):
  - 10 × 7r3  +  10 × 7r4,  signature ∈ {0, 20, 200}
  - ~7 regular users also receive 1 × 7r5  (admins never get one)

Usage:
    make fixtures
    # or
    python -m src.fixtures.sample_data
"""

from datetime import datetime, timedelta

from faker import Faker
from sqlmodel import Session, select

from src.enums.InvitationStatus import InvitationStatus
from src.enums.Roles import Roles
from src.enums.SeasonStatus import SeasonStatus
from src.enums.SeasonFormat import SeasonFormat
from src.models import User, LoginLog
from src.utils.email_hash import hash_email
from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.models.AllianceOfficer import AllianceOfficer
from src.models.AllianceInvitation import AllianceInvitation
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccountMastery import GameAccountMastery
from src.models.Mastery import Mastery
from src.models.RequestedUpgrade import RequestedUpgrade
from src.models.Season import Season
from src.models.War import War, WarStatus
from src.models.WarBan import WarBan
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarPrefightAttacker import WarPrefightAttacker
from src.models.WarSynergyAttacker import WarSynergyAttacker
from src.fixtures import sync_engine

fake = Faker(locale="en")
NOW = datetime.now()

GAME_PSEUDOS = [
    "CosmicFlop",
    "Trickshot3000",
    "SupremePoulet",
    "Megacard14",
    "DarkPhoenix",
    "XMutant77",
    "CosmicGhost",
    "IronWill",
    "ViperStrike",
    "ShadowClaw",
    "NovaBlade",
    "ThunderFist",
    "CrimsonWolf",
    "FrostBite99",
    "SteelNerve",
    "BlazeFury",
    "StormBreaker",
    "VenomPulse",
    "TitanForce",
    "HawkEyeX",
    "NightCrawlr",
    "WolfGangX",
    "QuantumRage",
    "AbyssWalkr",
    "MysticFlare",
    "NeonSurge",
    "OmegaPrime",
    "CyberVortex",
]  # exactly 28

# Signatures observed in prod (wide spread), used deterministically.
SIG_CYCLE = [0, 1, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]


def roster_size(user_index: int) -> int:
    """Deterministic roster size in [15, 45]."""
    return 15 + (user_index * 17) % 31


def roster_rank(slot: int, size: int) -> int:
    """Rank per slot reproducing prod shape: r1 ~7%, r2 ~4%, r3 ~32%, r4 ~51%, r5 ~7%."""
    frac = slot / max(size, 1)
    if frac < 0.07:
        return 1
    if frac < 0.11:
        return 2
    if frac < 0.43:
        return 3
    if frac < 0.93:
        return 4
    return 5


def roster_ascension(slot: int, user_index: int, rank: int, is_ascendable: bool) -> int:
    """Ascension 0..2. Always 0 unless the champion is ascendable and rank >= 4."""
    if not is_ascendable or rank < 4:
        return 0
    bucket = (slot * 7 + user_index * 13) % 6
    if bucket == 0:
        return 2
    if bucket in (1, 2):
        return 1
    return 0


def roster_signature(slot: int, user_index: int) -> int:
    return SIG_CYCLE[(slot + user_index) % len(SIG_CYCLE)]


def is_preferred_slot(slot: int, user_index: int, size: int) -> bool:
    """Exactly one preferred attacker per roster."""
    return slot == (user_index % max(size, 1))


# (battlegroup, node_number, stars, rank, ascension, ko_count)
# Ended wars — dense layout with varied ko_count
WAR_ENDED_NODE_LAYOUT = [
    # BG1
    (1, 2, 7, 4, 0, 0),
    (1, 6, 7, 4, 0, 1),
    (1, 9, 7, 3, 0, 0),
    (1, 13, 7, 4, 0, 2),
    (1, 17, 7, 4, 0, 0),
    (1, 21, 7, 4, 0, 1),
    (1, 25, 7, 4, 0, 0),
    (1, 29, 7, 4, 0, 0),
    (1, 32, 7, 4, 0, 3),
    (1, 38, 7, 4, 0, 1),
    (1, 41, 7, 3, 0, 0),
    (1, 44, 7, 4, 0, 2),
    (1, 48, 7, 4, 0, 0),
    (1, 50, 7, 4, 0, 1),
    (1, 53, 7, 3, 0, 0),
    # BG2
    (2, 1, 7, 4, 0, 1),
    (2, 5, 7, 4, 0, 0),
    (2, 8, 7, 4, 0, 2),
    (2, 11, 7, 4, 0, 0),
    (2, 15, 7, 3, 0, 1),
    (2, 20, 7, 4, 0, 0),
    (2, 24, 7, 4, 0, 0),
    (2, 28, 7, 4, 0, 2),
    (2, 33, 7, 4, 0, 0),
    (2, 36, 7, 4, 0, 1),
    (2, 40, 7, 4, 0, 0),
    (2, 43, 7, 3, 0, 3),
    (2, 46, 7, 4, 0, 0),
    (2, 51, 7, 4, 0, 1),
    (2, 55, 7, 4, 0, 0),
    # BG3
    (3, 3, 7, 3, 0, 0),
    (3, 7, 7, 4, 0, 1),
    (3, 12, 7, 4, 0, 0),
    (3, 16, 7, 4, 0, 2),
    (3, 19, 7, 3, 0, 0),
    (3, 23, 7, 4, 0, 1),
    (3, 26, 7, 4, 0, 0),
    (3, 30, 7, 4, 0, 0),
    (3, 35, 7, 4, 0, 2),
    (3, 39, 7, 4, 0, 1),
    (3, 42, 7, 4, 0, 0),
    (3, 45, 7, 3, 0, 3),
    (3, 49, 7, 4, 0, 0),
    (3, 52, 7, 4, 0, 1),
    (3, 54, 7, 4, 0, 0),
]

# Active war — dense layout with varied ko_count for stats
WAR_ACTIVE_NODE_LAYOUT = [
    # BG1
    (1, 4, 7, 4, 0, 0),
    (1, 7, 7, 4, 0, 1),
    (1, 10, 7, 3, 0, 0),
    (1, 17, 7, 4, 0, 2),
    (1, 21, 7, 4, 0, 0),
    (1, 25, 7, 4, 0, 1),
    (1, 32, 7, 4, 0, 0),
    (1, 38, 7, 4, 0, 3),
    (1, 44, 7, 3, 0, 0),
    (1, 50, 7, 4, 0, 1),
    (1, 53, 7, 4, 0, 0),
    # BG2
    (2, 2, 7, 4, 0, 0),
    (2, 5, 7, 4, 0, 2),
    (2, 9, 7, 3, 0, 0),
    (2, 11, 7, 4, 0, 1),
    (2, 16, 7, 4, 0, 0),
    (2, 22, 7, 4, 0, 0),
    (2, 30, 7, 4, 0, 1),
    (2, 36, 7, 4, 0, 0),
    (2, 46, 7, 4, 0, 2),
    (2, 51, 7, 4, 0, 0),
    (2, 54, 7, 3, 0, 1),
    # BG3
    (3, 1, 7, 4, 0, 0),
    (3, 3, 7, 3, 0, 1),
    (3, 8, 7, 4, 0, 0),
    (3, 14, 7, 4, 0, 2),
    (3, 19, 7, 4, 0, 0),
    (3, 26, 7, 4, 0, 1),
    (3, 33, 7, 4, 0, 0),
    (3, 40, 7, 4, 0, 0),
    (3, 49, 7, 4, 0, 3),
    (3, 52, 7, 3, 0, 0),
]

# BG1 nodes with defenders in active war — used for the "full combats" GA prefights
BG1_NODES = [row[1] for row in WAR_ACTIVE_NODE_LAYOUT if row[0] == 1][:5]  # first 5


def _valid_layout(layout: list) -> list:
    """Keep only rows whose node_number is within the NodeNumber bound (1..50)."""
    return [row for row in layout if 1 <= row[1] <= 50]


def _pick_champions(user_index: int, all_names: list, count: int) -> list:
    n = len(all_names)
    step = 37
    start = (user_index * 71) % n
    picks: list = []
    seen: set = set()
    j = 0
    while len(picks) < count:
        idx = (start + j * step) % n
        name = all_names[idx]
        if name not in seen:
            picks.append(name)
            seen.add(name)
        j += 1
        if j > n * 3:
            break
    return picks


def _build_roster(
    game_account_id, user_index: int, champions_db: dict, has_7r5: bool = False
) -> list:
    all_names = sorted(champions_db.keys())
    size = roster_size(user_index)
    names = _pick_champions(user_index, all_names, size)

    entries = []
    for slot, name in enumerate(names):
        champ = champions_db.get(name)
        if champ is None:
            continue
        rank = roster_rank(slot, size)
        ascension = roster_ascension(slot, user_index, rank, champ.is_ascendable)
        entries.append(
            ChampionUser(
                game_account_id=game_account_id,
                champion_id=champ.id,
                stars=7,
                rank=rank,
                signature=roster_signature(slot, user_index),
                is_preferred_attacker=is_preferred_slot(slot, user_index, size),
                ascension=ascension,
            )
        )
    return entries


def load_sample_data(engine=sync_engine):
    try:
        with Session(engine) as session:
            # ── Champion catalogue ────────────────────────────────────────────────
            champions_list = session.exec(select(Champion)).all()
            champions_db: dict = {c.name: c for c in champions_list}
            if not champions_db:
                print("⚠️  No champions in DB — run `make load-champions` first, then retry.")
                return
            print(f"📚 Loaded {len(champions_db)} champions from DB")

            masteries_list = session.exec(select(Mastery)).all()
            masteries_db: dict = {m.name: m for m in masteries_list}
            print(f"📚 Loaded {len(masteries_db)} masteries from DB")

            game_accounts: list[GameAccount] = []
            all_rosters: dict = {}  # game_account.id -> list[ChampionUser]

            # ── Super admin (index 0) ─────────────────────────────────────────────
            print("🚀 Creating super admin...")
            super_admin = User(
                email_hash=hash_email("misterbalise2@gmail.com"),
                login="misterbalise2",
                discord_id="403941390586871808",
                role=Roles.SUPER_ADMIN,
                created_at=fake.date_time_between(start_date="-1y", end_date=NOW),
                last_login_date=NOW,
            )
            session.add(super_admin)
            session.flush()

            super_admin_game = GameAccount(
                user_id=super_admin.id, game_pseudo="Mr DrBalise", is_primary=True
            )
            session.add(super_admin_game)
            session.flush()
            game_accounts.append(super_admin_game)

            roster = _build_roster(super_admin_game.id, 0, champions_db, has_7r5=False)
            for entry in roster:
                session.add(entry)
            session.flush()
            all_rosters[super_admin_game.id] = roster

            # ── Simple admin (index 1) ────────────────────────────────────────────
            print("🚀 Creating simple admin...")
            simple_admin = User(
                email_hash=hash_email("misterbalise@gmail.com"),
                login="misterbalise",
                discord_id="1274730290698256406",
                role=Roles.ADMIN,
                created_at=fake.date_time_between(start_date="-1y", end_date=NOW),
                last_login_date=fake.date_time_between(start_date="-7d", end_date=NOW),
            )
            session.add(simple_admin)
            session.flush()

            simple_admin_game = GameAccount(
                user_id=simple_admin.id, game_pseudo="B DrBalise", is_primary=True
            )
            session.add(simple_admin_game)
            session.flush()
            game_accounts.append(simple_admin_game)

            roster = _build_roster(simple_admin_game.id, 1, champions_db, has_7r5=False)
            for entry in roster:
                session.add(entry)
            session.flush()
            all_rosters[simple_admin_game.id] = roster

            # ── 28 regular users (indices 2–29) ───────────────────────────────────
            print("🚀 Creating 28 users with game accounts and rosters...")
            for i, pseudo in enumerate(GAME_PSEUDOS):
                user_index = i + 2
                slug = pseudo.lower().replace(" ", "_")
                # ~22% of users have a Google identity; every 9th of those is Google-only.
                has_google = user_index % 9 in (2, 5)
                google_only = user_index % 9 == 5
                user = User(
                    login=f"{slug}_{user_index:02d}",
                    email_hash=hash_email(f"{slug}_{user_index:02d}@gmail.com"),
                    discord_id=None if google_only else f"discord_{slug}_{user_index}",
                    google_id=f"google_{slug}_{user_index}" if has_google else None,
                    role=Roles.USER,
                    created_at=fake.date_time_between(start_date="-1y", end_date=NOW),
                    last_login_date=fake.date_time_between(start_date="-30d", end_date=NOW),
                    disabled_at=(NOW - timedelta(days=3)) if user_index == 15 else None,
                )
                session.add(user)
                session.flush()

                ga = GameAccount(user_id=user.id, game_pseudo=pseudo, is_primary=True)
                session.add(ga)
                session.flush()
                game_accounts.append(ga)

                has_7r5 = user_index % 4 == 2
                roster = _build_roster(ga.id, user_index, champions_db, has_7r5=has_7r5)
                for entry in roster:
                    session.add(entry)
                session.flush()
                all_rosters[ga.id] = roster

                # A couple of users own a second (alt) game account.
                if user_index in (4, 7):
                    alt = GameAccount(user_id=user.id, game_pseudo=f"{pseudo}Alt", is_primary=False)
                    session.add(alt)
                    session.flush()
                    game_accounts.append(alt)
                    alt_roster = _build_roster(alt.id, user_index + 100, champions_db)
                    for entry in alt_roster:
                        session.add(entry)
                    session.flush()
                    all_rosters[alt.id] = alt_roster

                session.add(
                    LoginLog(
                        id_user=user.id,
                        date_connexion=fake.date_time_between(start_date="-30d", end_date=NOW),
                    )
                )

            # ── Alliance ─────────────────────────────────────────────────────────
            print("🚀 Creating alliance ...")
            alliance = Alliance(
                name="Demo HEHE",
                tag="DEMO",
                owner_id=super_admin_game.id,
                elo=3800,
                tier=1,
                created_at=NOW - timedelta(days=33),
            )
            session.add(alliance)
            session.flush()

            # Demo HEHE gets the first 25 accounts across 3 battlegroups.
            demo_members = game_accounts[:25]
            for number, ga in enumerate(demo_members):
                ga.alliance_id = alliance.id
                ga.alliance_group = number % 3 + 1
                session.add(ga)
            session.flush()

            # Second, smaller alliance owned by a mid-roster account.
            second_owner = game_accounts[25]
            alliance2 = Alliance(
                name="Second Wave",
                tag="SCND",
                owner_id=second_owner.id,
                elo=3600,
                tier=2,
                created_at=NOW - timedelta(days=20),
            )
            session.add(alliance2)
            session.flush()
            for number, ga in enumerate(game_accounts[25:30]):
                ga.alliance_id = alliance2.id
                ga.alliance_group = number % 3 + 1
                session.add(ga)
            session.flush()

            # Empty, unranked alliance (owner only) — mirrors freshly created prod alliances.
            empty_owner = game_accounts[30] if len(game_accounts) > 30 else game_accounts[-1]
            alliance_empty = Alliance(
                name="Fresh Recruits",
                tag="FRESH",
                owner_id=empty_owner.id,
                elo=0,
                tier=20,
                created_at=NOW - timedelta(days=1),
            )
            session.add(alliance_empty)
            session.flush()
            empty_owner.alliance_id = alliance_empty.id
            empty_owner.alliance_group = 1
            session.add(empty_owner)
            session.flush()

            # ── Officers (5 members) ──────────────────────────────────────────────
            print("🚀 Creating alliance officers...")
            for idx in range(2, 7):
                session.add(
                    AllianceOfficer(
                        alliance_id=alliance.id,
                        game_account_id=game_accounts[idx].id,
                        assigned_at=fake.date_time_between(start_date="-30d", end_date=NOW),
                    )
                )

            # ── Alliance invitation (pending, to a non-existent outsider) ─────────
            # Invite game_accounts[10] by game_accounts[2] as an example
            session.add(
                AllianceInvitation(
                    alliance_id=alliance.id,
                    game_account_id=game_accounts[10].id,
                    invited_by_game_account_id=game_accounts[2].id,
                    status=InvitationStatus.PENDING,
                    created_at=NOW - timedelta(hours=2),
                )
            )
            session.add(
                AllianceInvitation(
                    alliance_id=alliance.id,
                    game_account_id=game_accounts[11].id,
                    invited_by_game_account_id=game_accounts[2].id,
                    status=InvitationStatus.ACCEPTED,
                    created_at=NOW - timedelta(days=5),
                    responded_at=NOW - timedelta(days=4, hours=22),
                )
            )

            # ── Game account masteries ────────────────────────────────────────────
            if masteries_db:
                print("🚀 Creating game account masteries...")
                mastery_presets = [
                    {
                        "MYSTIC DISPERSION": (5, 5, 5),
                        "STAND YOUR GROUND": (5, 5, 5),
                        "ASSASSIN": (5, 3, 3),
                    },
                    {"RECOIL": (3, 0, 3), "DOUBLE EDGE": (3, 0, 3), "LIMBER": (5, 3, 0)},
                    {"DESPAIR": (3, 3, 3), "COLLAR TECH": (5, 5, 0), "LIQUID COURAGE": (3, 0, 0)},
                ]
                for ga_idx, preset in enumerate(mastery_presets):
                    ga = game_accounts[ga_idx]
                    for name, (unlocked, attack, defense) in preset.items():
                        mastery = masteries_db.get(name)
                        if mastery:
                            session.add(
                                GameAccountMastery(
                                    game_account_id=ga.id,
                                    mastery_id=mastery.id,
                                    unlocked=unlocked,
                                    attack=attack,
                                    defense=defense,
                                )
                            )

            # ── Requested upgrades ────────────────────────────────────────────────
            print("🚀 Creating requested upgrades...")
            # (roster_ga_offset, cu_slot, rarity, days_ago_created, days_ago_done or None)
            upgrade_specs = [
                (0, 0, "7r4", 9, 1),
                (1, 1, "7r5", 19, 9),
                (2, 0, "7r4", 11, None),
                (3, 2, "7r4", 8, None),
                (4, 3, "7r4", 5, 4),
                (5, 1, "7r4", 9, None),
                (2, 4, "7r4", 8, 7),
            ]
            for ga_off, cu_slot, rarity, days_created, days_done in upgrade_specs:
                ga = game_accounts[(ga_off + 2) % len(game_accounts)]
                requester = game_accounts[(ga_off + 3) % len(game_accounts)]
                roster = all_rosters.get(ga.id, [])
                if not roster:
                    continue
                cu = roster[cu_slot % len(roster)]
                session.add(
                    RequestedUpgrade(
                        champion_user_id=cu.id,
                        requester_game_account_id=requester.id,
                        requested_rarity=rarity,
                        created_at=NOW - timedelta(days=days_created),
                        done_at=NOW - timedelta(days=days_done) if days_done is not None else None,
                    )
                )

            # ── Seasons 60-67 (67 active, rest ended) ─────────────────────────────
            print("🚀 Creating seasons 60-67...")
            seasons = {}
            for number in range(60, 68):
                season = Season(
                    number=number,
                    status=SeasonStatus.active if number == 67 else SeasonStatus.ended,
                    format=SeasonFormat.regular,
                )
                session.add(season)
                session.flush()
                seasons[number] = season

            # ── Wars for Demo HEHE (2 ended + 1 active) ───────────────────────────
            print("🚀 Creating wars...")
            demo_roster_gas = [ga for ga in demo_members]
            # champion_users of the alliance, grouped for saga-aware picking
            alliance_cus = [cu for ga in demo_roster_gas for cu in all_rosters.get(ga.id, [])]
            champ_by_id = {c.id: c for c in champions_list}
            saga_def_cus = [
                cu for cu in alliance_cus if champ_by_id[cu.champion_id].is_saga_defender
            ]
            saga_atk_cus = [
                cu for cu in alliance_cus if champ_by_id[cu.champion_id].is_saga_attacker
            ]
            defender_pool = saga_def_cus or alliance_cus
            attacker_pool = saga_atk_cus or alliance_cus

            war_specs = [
                # (opponent, status, season, win, elo_change, tier, days_ago, layout)
                ("ABI58", WarStatus.ended, 66, True, 33, 3, 40, WAR_ENDED_NODE_LAYOUT),
                ("XMN.M", WarStatus.ended, 67, False, -19, 1, 6, WAR_ENDED_NODE_LAYOUT),
                ("U.KR", WarStatus.active, 67, None, None, 1, 1, WAR_ACTIVE_NODE_LAYOUT),
            ]
            wars = []
            for opponent, wstatus, season_no, win, elo_change, tier, days_ago, layout in war_specs:
                created = NOW - timedelta(days=days_ago)
                war = War(
                    alliance_id=alliance.id,
                    opponent_name=opponent,
                    status=wstatus,
                    created_by_id=super_admin_game.id,
                    season_id=seasons[season_no].id,
                    win=win,
                    elo_change=elo_change,
                    tier=tier,
                    created_at=created,
                    snapshotted_at=(created + timedelta(days=2))
                    if wstatus == WarStatus.ended
                    else None,
                )
                session.add(war)
                session.flush()
                wars.append(war)

                # Defense placements from the (guarded) layout.
                for i, (bg, node, stars, rank, ascension, ko) in enumerate(_valid_layout(layout)):
                    defender = defender_pool[i % len(defender_pool)]
                    champ = champ_by_id[defender.champion_id]
                    combat_done = wstatus == WarStatus.ended or ko > 0
                    attacker = attacker_pool[i % len(attacker_pool)] if combat_done else None
                    session.add(
                        WarDefensePlacement(
                            war_id=war.id,
                            battlegroup=bg,
                            node_number=node,
                            champion_id=champ.id,
                            stars=stars,
                            rank=rank,
                            ascension=ascension if champ.is_ascendable else 0,
                            placed_by_id=super_admin_game.id,
                            attacker_champion_user_id=attacker.id if attacker else None,
                            ko_count=ko,
                            is_combat_completed=combat_done,
                        )
                    )

                # ~5 bans per war (distinct champions from the catalogue).
                for champ in champions_list[:5]:
                    session.add(WarBan(war_id=war.id, champion_id=champ.id))

            session.flush()

            # ── Prefight / synergy attackers on the active war's BG1 ──────────────
            print("🚀 Creating prefight/synergy attackers...")
            active_war = wars[-1]
            bg1_gas = [ga for ga in demo_members if ga.alliance_group == 1]
            banned_ids = {
                b.champion_id
                for b in session.exec(select(WarBan).where(WarBan.war_id == active_war.id)).all()
            }
            bg1_defense_cu_ids = {
                p.attacker_champion_user_id
                for p in session.exec(
                    select(WarDefensePlacement).where(
                        WarDefensePlacement.war_id == active_war.id,
                        WarDefensePlacement.battlegroup == 1,
                    )
                ).all()
                if p.attacker_champion_user_id
            }
            prefight_cus = [
                cu
                for ga in bg1_gas
                for cu in all_rosters.get(ga.id, [])
                if champ_by_id[cu.champion_id].has_prefight
                and cu.champion_id not in banned_ids
                and cu.id not in bg1_defense_cu_ids
            ]
            for i, target_node in enumerate(BG1_NODES[:3]):
                if i >= len(prefight_cus):
                    break
                cu = prefight_cus[i]
                session.add(
                    WarPrefightAttacker(
                        war_id=active_war.id,
                        battlegroup=1,
                        game_account_id=cu.game_account_id,
                        champion_user_id=cu.id,
                        target_node_number=target_node,
                    )
                )
            # One synergy attacker if we have two distinct BG1 champion_users.
            bg1_cus = [cu for ga in bg1_gas for cu in all_rosters.get(ga.id, [])]
            if len(bg1_cus) >= 2:
                session.add(
                    WarSynergyAttacker(
                        war_id=active_war.id,
                        battlegroup=1,
                        game_account_id=bg1_cus[0].game_account_id,
                        champion_user_id=bg1_cus[0].id,
                        target_champion_user_id=bg1_cus[1].id,
                    )
                )

            session.commit()

            total = len(game_accounts)
            print(f"✅ {total} users (1 super admin + 1 admin + {total - 2} regular)")
            print("✅ Alliance 'Demo HEHE' [DEMO] — elo 3800, tier 1")
            print("✅ 5 officers, 2 invitations")
            print("✅ Season 66 (active)")
            print("✅ 3 wars — ended vs ABI58 (+33), ended vs XMN.M (+32), active vs U.KR")
            print("✅ War bans, defense placements, prefight/synergy attackers seeded")
            print("✅ Persistent defense placements, masteries, upgrade requests seeded")
            print("✅ Super admin: login=misterbalise2 | game=Mr DrBalise")
            print("✅ Simple admin: login=misterbalise  | game=B DrBalise")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise


if __name__ == "__main__":
    load_sample_data()
