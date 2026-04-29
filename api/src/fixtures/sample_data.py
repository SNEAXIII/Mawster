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
from src.models import User, LoginLog
from src.utils.email_hash import hash_email
from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.models.AllianceOfficer import AllianceOfficer
from src.models.AllianceInvitation import AllianceInvitation
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.DefensePlacement import DefensePlacement
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
    "SAINT",
    "Circle",
    "Papa Supremacy",
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

SIG_CYCLE = [
    200,
    20,
    0,
    200,
    200,
    20,
    0,
    200,
    20,
    0,  # slots  0-9  (7r3)
    200,
    20,
    200,
    0,
    20,
    200,
    20,
    0,
    200,
    20,  # slots 10-19 (7r4)
    200,  # slot  20   (7r5)
]

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


def _build_roster(game_account_id, user_index: int, champions_db: dict, has_7r5: bool) -> list:
    all_names = sorted(champions_db.keys())
    count = 21 if has_7r5 else 20
    names = _pick_champions(user_index, all_names, count)

    entries = []
    for slot, name in enumerate(names):
        if name not in champions_db:
            continue
        champ = champions_db[name]
        if slot < 10:
            stars, rank = 7, 3
        elif slot < 20:
            stars, rank = 7, 4
        else:
            stars, rank = 7, 5
        entries.append(
            ChampionUser(
                game_account_id=game_account_id,
                champion_id=champ.id,
                stars=stars,
                rank=rank,
                signature=SIG_CYCLE[slot % len(SIG_CYCLE)],
                is_preferred_attacker=False,
            )
        )
    return entries


def load_sample_data():
    try:
        with Session(sync_engine) as session:
            # ── Champion catalogue ────────────────────────────────────────────────
            champions_list = session.exec(select(Champion)).all()
            champions_db: dict = {c.name: c for c in champions_list}
            if not champions_db:
                print("⚠️  No champions in DB — run `make load-champions` first, then retry.")
                return
            print(f"📚 Loaded {len(champions_db)} champions from DB")
            champions_sorted = sorted(champions_db.values(), key=lambda c: c.name)

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
                user = User(
                    login=f"{slug}_{user_index:02d}",
                    email_hash=hash_email(f"{slug}_{user_index:02d}@gmail.com"),
                    discord_id=f"discord_{slug}_{user_index}",
                    role=Roles.USER,
                    created_at=fake.date_time_between(start_date="-1y", end_date=NOW),
                    last_login_date=fake.date_time_between(start_date="-30d", end_date=NOW),
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

                session.add(
                    LoginLog(
                        id_user=user.id,
                        date_connexion=fake.date_time_between(start_date="-30d", end_date=NOW),
                    )
                )

            # ── Alliance ─────────────────────────────────────────────────────────
            print("🚀 Creating alliance 'WE ARE AM6' [WAM6]...")
            alliance = Alliance(
                name="WE ARE AM6",
                tag="WAM6",
                owner_id=super_admin_game.id,
                elo=3326,
                tier=3,
                created_at=NOW - timedelta(days=33),
            )
            session.add(alliance)
            session.flush()

            for number, ga in enumerate(game_accounts):
                ga.alliance_id = alliance.id
                ga.alliance_group = number % 3 + 1
                session.add(ga)
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

            # ── Season ───────────────────────────────────────────────────────────
            print("🚀 Creating season 66...")
            season = Season(number=66, is_active=True)
            session.add(season)
            session.flush()

            # ── Wars ─────────────────────────────────────────────────────────────
            print("🚀 Creating wars...")
            war_ended_1 = War(
                alliance_id=alliance.id,
                opponent_name="ABI58",
                status=WarStatus.ended,
                created_by_id=super_admin_game.id,
                created_at=NOW - timedelta(days=2, hours=1),
                season_id=season.id,
                win=True,
                elo_change=33,
                tier=3,
            )
            war_ended_2 = War(
                alliance_id=alliance.id,
                opponent_name="XMN.M",
                status=WarStatus.ended,
                created_by_id=super_admin_game.id,
                created_at=NOW - timedelta(days=4, hours=1),
                season_id=season.id,
                win=True,
                elo_change=32,
                tier=4,
            )
            war_active = War(
                alliance_id=alliance.id,
                opponent_name="U.KR",
                status=WarStatus.active,
                created_by_id=super_admin_game.id,
                created_at=NOW - timedelta(hours=1),
                season_id=season.id,
            )
            session.add(war_ended_1)
            session.add(war_ended_2)
            session.add(war_active)
            session.flush()

            # ── War bans (4 unique champions per war) ────────────────────────────
            print("🚀 Creating war bans...")
            for offset, war in enumerate([war_ended_1, war_ended_2, war_active]):
                for j in range(4):
                    champ = champions_sorted[(offset * 4 + j) % len(champions_sorted)]
                    session.add(WarBan(war_id=war.id, champion_id=champ.id))

            # ── War defense placements ────────────────────────────────────────────
            print("🚀 Creating war defense placements...")
            # Group alliance members by BG for attacker assignment
            ga_by_bg: dict[int, list] = {1: [], 2: [], 3: []}
            for idx, ga in enumerate(game_accounts):
                ga_by_bg[idx % 3 + 1].append(ga)

            for war_offset, (war, layout) in enumerate(
                [
                    (war_ended_1, WAR_ENDED_NODE_LAYOUT),
                    (war_ended_2, WAR_ENDED_NODE_LAYOUT),
                    (war_active, WAR_ACTIVE_NODE_LAYOUT),
                ]
            ):
                for k, (bg, node, stars, rank, asc, ko) in enumerate(layout):
                    champ = champions_sorted[
                        (war_offset * len(layout) + k + 20) % len(champions_sorted)
                    ]
                    placer = game_accounts[(k + 2) % len(game_accounts)]

                    # Stats query joins on attacker_champion_user_id — only set for ended wars
                    attacker_cu_id = None
                    if war.status == WarStatus.ended:
                        pool = ga_by_bg[bg]
                        attacker_ga = pool[k % len(pool)]
                        attacker_roster = all_rosters.get(attacker_ga.id, [])
                        if attacker_roster:
                            attacker_cu_id = attacker_roster[(k + 5) % len(attacker_roster)].id

                    session.add(
                        WarDefensePlacement(
                            war_id=war.id,
                            battlegroup=bg,
                            node_number=node,
                            champion_id=champ.id,
                            stars=stars,
                            rank=rank,
                            ascension=asc,
                            placed_by_id=placer.id,
                            created_at=fake.date_time_between(start_date="-5d", end_date=NOW),
                            ko_count=ko,
                            attacker_champion_user_id=attacker_cu_id,
                        )
                    )

            # ── Full combats GA (game_accounts[3] = Circle, BG1) ─────────────────
            # 5 prefights + 5 synergies on all 5 BG1 nodes → simulates a fully active attacker
            print("🚀 Creating full-combats attacker (Circle, BG1)...")
            full_ga = game_accounts[3]  # BG1 (3 % 3 + 1 = 1)
            full_roster = all_rosters[full_ga.id]
            synergy_target_ga = game_accounts[6]  # another BG1 member (6 % 3 + 1 = 1)
            synergy_target_roster = all_rosters[synergy_target_ga.id]
            used_synergy: set = set()
            for slot, node in enumerate(BG1_NODES):
                cu = full_roster[slot % len(full_roster)]
                session.add(
                    WarPrefightAttacker(
                        war_id=war_active.id,
                        battlegroup=1,
                        game_account_id=full_ga.id,
                        champion_user_id=cu.id,
                        target_node_number=node,
                        created_at=fake.date_time_between(start_date="-12h", end_date=NOW),
                    )
                )
                cu_target = synergy_target_roster[(slot + 5) % len(synergy_target_roster)]
                key = (war_active.id, 1, cu.id)
                if key not in used_synergy:
                    used_synergy.add(key)
                    session.add(
                        WarSynergyAttacker(
                            war_id=war_active.id,
                            battlegroup=1,
                            game_account_id=full_ga.id,
                            champion_user_id=cu.id,
                            target_champion_user_id=cu_target.id,
                            created_at=fake.date_time_between(start_date="-12h", end_date=NOW),
                        )
                    )

            # ── Persistent defense placements ─────────────────────────────────────
            # Rule: ga.alliance_group must match battlegroup (DefensePlacementService)
            print("🚀 Creating persistent defense placements...")
            bg_accounts: dict[int, list[GameAccount]] = {1: [], 2: [], 3: []}
            for idx, ga in enumerate(game_accounts):
                group = idx % 3 + 1
                bg_accounts[group].append(ga)

            defense_nodes = [(1, 32), (2, 22), (3, 17), (3, 10), (2, 46)]
            bg_counters: dict[int, int] = {1: 0, 2: 0, 3: 0}
            for cu_slot, (bg, node) in enumerate(defense_nodes):
                pool = bg_accounts[bg]
                ga = pool[bg_counters[bg] % len(pool)]
                bg_counters[bg] += 1
                roster = all_rosters.get(ga.id, [])
                if not roster:
                    continue
                cu = roster[cu_slot % len(roster)]
                session.add(
                    DefensePlacement(
                        alliance_id=alliance.id,
                        battlegroup=bg,
                        node_number=node,
                        champion_user_id=cu.id,
                        game_account_id=ga.id,
                        placed_by_id=super_admin_game.id,
                        created_at=fake.date_time_between(start_date="-14d", end_date=NOW),
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

            session.commit()

            total = len(game_accounts)
            print(f"✅ {total} users (1 super admin + 1 admin + {total - 2} regular)")
            print("✅ Alliance 'WE ARE AM6' [WAM6] — elo 3326, tier 3")
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
