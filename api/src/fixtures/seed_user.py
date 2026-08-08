"""Create or promote a user, for development only.

The app has no registration endpoint: an account only exists after a verified
Discord or Google OAuth round trip. That is the right design for production and
a nuisance in development, where you often need "a super admin, now".

This fixture fills that gap without adding any HTTP surface: no endpoint means
nothing to accidentally ship, nothing to leave enabled by a mistaken
environment variable.

Usage:
    make seed-user LOGIN=Sneaxiii
    make seed-user LOGIN=Sneaxiii ROLE=super_admin
    make seed-user LOGIN=Sneaxiii ROLE=admin DISCORD_ID=403941390586871808

    # or directly
    python -m src.fixtures.seed_user --login Sneaxiii --role super_admin

An existing login is promoted rather than duplicated, so running the command
twice is safe and `LOGIN=<your own account>` is how you give yourself rights.

Output is plain ASCII on purpose: the emoji used elsewhere in these fixtures
crash on a Windows console reading cp1252.
"""

import argparse
import sys

from sqlmodel import Session, select

from src.enums.Roles import Roles
from src.fixtures import sync_engine
from src.models import User
from src.validators.user_validator import login_validator


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="seed-user",
        description="Create a development user, or promote an existing one.",
    )
    parser.add_argument("--login", required=True, help="Account login (alphanumeric)")
    parser.add_argument(
        "--role",
        default=Roles.USER.value,
        choices=[role.value for role in Roles],
        help="Role to grant (default: user)",
    )
    parser.add_argument(
        "--discord-id",
        default=None,
        help="Link the account to a Discord id, so you can actually sign in as it",
    )
    return parser.parse_args(argv)


def seed_user(login: str, role: Roles, discord_id: str | None = None) -> User:
    # The canonical validator, so a seeded login can never be one the API would
    # have refused.
    login = login_validator(login)

    with Session(sync_engine) as session:
        existing = session.exec(select(User).where(User.login == login)).first()

        if existing is None:
            user = User(login=login, role=role, discord_id=discord_id)
            session.add(user)
            session.commit()
            session.refresh(user)
            print(f"[created] {user.login} | role={user.role.value} | id={user.id}")
            if discord_id is None:
                print(
                    "[note]    no discord_id: this account cannot sign in through OAuth. "
                    "Re-run with DISCORD_ID=<your id> to link it."
                )
            return user

        # Promoting the account you already own is the common case; refusing it
        # would send you to a SQL client, which is what this script exists to
        # avoid.
        changes = []
        if existing.role != role:
            changes.append(f"role {existing.role.value} -> {role.value}")
            existing.role = role
        if discord_id is not None and existing.discord_id != discord_id:
            changes.append("discord_id updated")
            existing.discord_id = discord_id

        if not changes:
            print(f"[unchanged] {existing.login} | role={existing.role.value} | id={existing.id}")
            return existing

        session.add(existing)
        session.commit()
        session.refresh(existing)
        print(f"[updated] {existing.login} | {', '.join(changes)} | id={existing.id}")
        return existing


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        seed_user(args.login, Roles(args.role), args.discord_id)
    except ValueError as error:
        print(f"[error] {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
