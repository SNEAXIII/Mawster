"""
Seed script: creates 30 users (1 super admin + 1 admin + 28 users), each with 1 game account,
one alliance led by the super admin's account, and a deterministic roster of 20 champions.

Champion rosters (fully deterministic, no random):
  - 10 × 7r3  +  10 × 7r4,  signature ∈ {0, 20, 200}
  - ~7 regular users also receive 1 × 7r5  (the two admin accounts never get one)

Usage:
    make fixtures
    # or
    python -m src.fixtures.sample_data
"""

from datetime import datetime

from faker import Faker
from sqlmodel import Session, select

from src.enums.Roles import Roles
from src.models import User, LoginLog
from src.utils.email_hash import hash_email
from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.fixtures import sync_engine

fake = Faker(locale="en")
NOW = datetime.now()

# ─── Game pseudos for the 28 regular users ────────────────────────────────────
GAME_PSEUDOS = [
    "DarkPhoenix", "XMutant77",   "CosmicGhost", "IronWill",
    "ViperStrike",  "ShadowClaw",  "NovaBlade",   "ThunderFist",
    "CrimsonWolf",  "FrostBite99", "SteelNerve",  "BlazeFury",
    "StormBreaker", "VenomPulse",  "TitanForce",  "HawkEyeX",
    "NightCrawlr",  "WolfGangX",   "QuantumRage",  "AbyssWalkr",
    "MysticFlare",  "NeonSurge",   "OmegaPrime",   "CyberVortex",
    "PlasmaDuke",   "RuneKnight",  "AstralKing",   "ZeroGravity",
]  # exactly 28

ALLIANCE_NAMES = [("Elite 33", "E33")]

# ─── Signature pattern  ────────────────────────────────────────────────────────
# Cycles over the 21 possible slot positions (0-9 for 7r3, 10-19 for 7r4, 20 for 7r5)
SIG_CYCLE = [
    200, 20,  0, 200, 200,  20,  0, 200, 20,  0,   # slots  0-9  (7r3)
    200, 20, 200,  0,  20, 200,  20,  0, 200, 20,   # slots 10-19 (7r4)
    200,                                              # slot  20   (7r5, when present)
]


# ─── Deterministic champion selection ─────────────────────────────────────────

def _pick_champions(user_index: int, all_names: list, count: int) -> list:
    """
    Pick `count` unique champion names for the given user slot index.
    Uses a prime step (37) so selections spread evenly across the full catalogue,
    with a different starting point per user (offset by prime 71).
    No randomness — same inputs always produce the same output.
    """
    n = len(all_names)
    step = 37                          # prime, coprime with typical catalogue sizes
    start = (user_index * 71) % n      # 71 prime → different start per user

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
            break  # safety valve (should never trigger)
    return picks


def _build_roster(game_account_id, user_index: int, champions_db: dict, has_7r5: bool) -> list:
    """Return a list of ChampionUser objects for the given game account."""
    all_names = sorted(champions_db.keys())
    count = 21 if has_7r5 else 20
    names = _pick_champions(user_index, all_names, count)

    entries = []
    for slot, name in enumerate(names):
        if name not in champions_db:
            continue
        champ = champions_db[name]

        if slot < 10:
            stars, rank = 7, 3   # 7r3
        elif slot < 20:
            stars, rank = 7, 4   # 7r4
        else:
            stars, rank = 7, 5   # 7r5 — only slot 20, only when has_7r5=True

        sig = SIG_CYCLE[slot % len(SIG_CYCLE)]
        entries.append(ChampionUser(
            game_account_id=game_account_id,
            champion_id=champ.id,
            stars=stars,
            rank=rank,
            signature=sig,
            is_preferred_attacker=False,
        ))
    return entries


# ─── Main loader ──────────────────────────────────────────────────────────────

def load_sample_data():
    """Create 30 users, 30 game accounts, 1 alliance, and deterministic rosters."""
    try:
        with Session(sync_engine) as session:

            # ── Load champion catalogue from DB ──────────────────────────────────
            champions_list = session.exec(select(Champion)).all()
            champions_db: dict = {c.name: c for c in champions_list}
            if not champions_db:
                print("⚠️  No champions in DB — run `make load-champions` first, then retry.")
                return
            print(f"📚 Loaded {len(champions_db)} champions from DB")

            game_accounts: list = []

            # ── Index 0 — Super admin ────────────────────────────────────────────
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
                user_id=super_admin.id,
                game_pseudo="Mr DrBalise",
                is_primary=True,
            )
            session.add(super_admin_game)
            session.flush()
            game_accounts.append(super_admin_game)

            # Roster — no 7r5 for the super admin
            for entry in _build_roster(super_admin_game.id, 0, champions_db, has_7r5=False):
                session.add(entry)

            # ── Index 1 — Simple admin ───────────────────────────────────────────
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
                user_id=simple_admin.id,
                game_pseudo="B DrBalise",
                is_primary=True,
            )
            session.add(simple_admin_game)
            session.flush()
            game_accounts.append(simple_admin_game)

            # Roster — no 7r5 for the simple admin either
            for entry in _build_roster(simple_admin_game.id, 1, champions_db, has_7r5=False):
                session.add(entry)

            # ── Indices 2-29 — 28 regular users ──────────────────────────────────
            print("🚀 Creating 28 users with game accounts and rosters...")
            for i, pseudo in enumerate(GAME_PSEUDOS):
                user_index = i + 2  # slot 0 and 1 are taken by the two admins

                login = f"{pseudo.lower()}_{user_index:02d}"
                email = f"{login}@gmail.com"
                discord_id = f"discord_{pseudo.lower()}_{user_index}"

                user = User(
                    login=login,
                    email_hash=hash_email(email),
                    discord_id=discord_id,
                    role=Roles.USER,
                    created_at=fake.date_time_between(start_date="-1y", end_date=NOW),
                    last_login_date=fake.date_time_between(start_date="-30d", end_date=NOW),
                )
                session.add(user)
                session.flush()

                game_account = GameAccount(
                    user_id=user.id,
                    game_pseudo=pseudo,
                    is_primary=True,
                )
                session.add(game_account)
                session.flush()
                game_accounts.append(game_account)

                # 7 out of 28 regular users get a 7r5  (user_index 2, 6, 10, 14, 18, 22, 26)
                has_7r5 = (user_index % 4 == 2)
                for entry in _build_roster(game_account.id, user_index, champions_db, has_7r5=has_7r5):
                    session.add(entry)

                session.add(LoginLog(
                    id_user=user.id,
                    date_connexion=fake.date_time_between(start_date="-30d", end_date=NOW),
                ))

            # ── Alliance ─────────────────────────────────────────────────────────
            print("🚀 Creating alliance 'Elite 33' [E33]...")
            alliance_name, alliance_tag = ALLIANCE_NAMES[0]
            alliance = Alliance(
                name=alliance_name,
                tag=alliance_tag,
                owner_id=super_admin_game.id,
            )
            session.add(alliance)
            session.flush()

            # All 30 accounts join the alliance, distributed across BG 1 / 2 / 3
            for number, game_account in enumerate(game_accounts):
                game_account.alliance_id = alliance.id
                game_account.alliance_group = number % 3 + 1
                session.add(game_account)

            session.commit()

            # ── Summary ──────────────────────────────────────────────────────────
            total = len(game_accounts)
            with_7r5 = sum(1 for ui in range(2, 30) if ui % 4 == 2)
            print(f"✅ {total} users created (1 super admin + 1 admin + {total - 2} regular users)")
            print(f"✅ {total} game accounts, all in alliance '{alliance_name}' [{alliance_tag}]")
            print("✅ Each user: 10×7r3 + 10×7r4, sig ∈ {{0, 20, 200}} — fully deterministic")
            print(f"✅ {with_7r5} regular users also have 1×7r5 champion")
            print("✅ Super admin : login=misterbalise  | game=Mr DrBalise")
            print("✅ Simple admin: login=misterbalise2 | game=B DrBalise")
            print("✅ Sample data loaded successfully!")

    except Exception as e:
        print(f"❌ Error loading sample data: {e}")
        raise


if __name__ == "__main__":
    load_sample_data()
