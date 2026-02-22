"""
Seed script: creates 30 users (1 admin + 29 users), each with 1 game account,
and one alliance led by the admin's account.

Usage:
    make fixtures
    # or
    python -m src.fixtures.sample_data
"""

from datetime import datetime
from random import randint, choice

from faker import Faker
from sqlmodel import Session

from src.enums.Roles import Roles
from src.models import User, LoginLog
from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.fixtures import sync_engine

fake = Faker(locale="en")
NOW = datetime.now()

# ──────────────────────────── Pseudos de jeu réalistes ────────────────────────
GAME_PSEUDOS = [
    "DarkPhoenix", "XMutant77", "CosmicGhost", "IronWill",
    "ViperStrike", "ShadowClaw", "NovaBlade", "ThunderFist",
    "CrimsonWolf", "FrostBite99", "SteelNerve", "BlazeFury",
    "StormBreaker", "VenomPulse", "TitanForce", "HawkEyeX",
    "NightCrawlr", "WolfGangX", "QuantumRage", "AbyssWalkr",
    "MysticFlare", "NeonSurge", "OmegaPrime", "CyberVortex",
    "PlasmaDuke", "RuneKnight", "AstralKing", "ZeroGravity",
    "EchoPhantom",
]

ALLIANCE_NAMES = [
    ("Elite 33", "E33"),
]


def load_sample_data():
    """Create 30 users, 30 game accounts, 1 alliance."""
    try:
        with Session(sync_engine) as session:
            # ─────────────── 1. Admin (toi) ───────────────
            print("🚀 Creating admin account (misterbalise)...")
            admin = User(
                email="misterbalise2@gmail.com",
                login="misterbalise",
                discord_id="403941390586871808",
                role=Roles.ADMIN,
                created_at=fake.date_time_between(start_date="-1y", end_date=NOW),
                last_login_date=NOW,
            )
            session.add(admin)
            session.flush()  # get admin.id

            admin_game = GameAccount(
                user_id=admin.id,
                game_pseudo="Mr DrBalise",
                is_primary=True,
            )
            session.add(admin_game)
            session.flush()  # get admin_game.id

            # ─────────────── 2. 29 other users ───────────────
            print("🚀 Creating 29 users with game accounts...")
            game_accounts = [admin_game]  # collect all for alliance membership

            for i, pseudo in enumerate(GAME_PSEUDOS):
                suffix = f"{randint(0, 9999):04d}"
                first = fake.first_name()
                login = f"{first}_{suffix}"
                email = f"{login.lower()}@gmail.com"
                discord_id = f"discord_{login}_{suffix}"

                user = User(
                    login=login,
                    email=email,
                    discord_id=discord_id,
                    role=Roles.USER,
                    created_at=fake.date_time_between(start_date="-1y", end_date=NOW),
                    last_login_date=fake.date_time_between(start_date="-30d", end_date=NOW),
                )
                session.add(user)
                session.flush()

                ga = GameAccount(
                    user_id=user.id,
                    game_pseudo=pseudo,
                    is_primary=True,
                )
                session.add(ga)
                session.flush()
                game_accounts.append(ga)

                # Login log
                session.add(LoginLog(
                    id_user=user.id,
                    date_connexion=fake.date_time_between(start_date="-30d", end_date=NOW),
                ))

            # ─────────────── 3. Alliance ───────────────
            print("🚀 Creating alliance 'Elite 33' [E33]...")
            alliance_name, alliance_tag = ALLIANCE_NAMES[0]
            alliance = Alliance(
                name=alliance_name,
                tag=alliance_tag,
                owner_id=admin_game.id,
            )
            session.add(alliance)
            session.flush()

            # Put admin + all 29 members in the alliance (30 total)
            for ga in game_accounts:
                ga.alliance_id = alliance.id
                ga.alliance_group = choice([1, 2, 3])
                session.add(ga)

            session.commit()

            print(f"✅ {len(game_accounts)} users created (1 admin + {len(game_accounts) - 1} users)")
            print(f"✅ {len(game_accounts)} game accounts created")
            print(f"✅ Alliance '{alliance_name}' [{alliance_tag}] created with {len(game_accounts)} members")
            print(f"✅ Admin: misterbalise (Mr DrBalise) — discord_id: 403941390586871808")
            print("✅ Sample data loaded with success!")

    except Exception as e:
        print(f"❌ Error loading sample data: {e}")
        raise


if __name__ == "__main__":
    load_sample_data()
