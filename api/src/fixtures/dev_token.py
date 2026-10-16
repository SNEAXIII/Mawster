"""Print an access token for a user, found by login or by game pseudo. Development only.

Usage:
    make dev-token                    # DEV_LOGIN, Misterbalise by default
    make dev-token PSEUDO=JulianSama  # the player behind that game account
    curl -H "Authorization: Bearer $(make -s dev-token)" localhost:8000/...
"""

import argparse
import sys

from sqlmodel import Session, select

from src.fixtures import sync_engine
from src.models import GameAccount, User
from src.services.auth.JWTService import JWTService


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="dev-token")
    who = parser.add_mutually_exclusive_group(required=True)
    who.add_argument("--login", help="User login")
    who.add_argument("--pseudo", help="In-game pseudo of a game account")
    args = parser.parse_args(argv)
    query = (
        select(User).join(GameAccount).where(GameAccount.game_pseudo == args.pseudo)
        if args.pseudo
        else select(User).where(User.login == args.login)
    )
    with Session(sync_engine) as session:
        user = session.exec(query).first()
    if user is None:
        print(f"[error] no user for {args.pseudo or args.login}", file=sys.stderr)
        return 1
    print(JWTService.create_access_token(user))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
