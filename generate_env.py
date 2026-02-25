#!/usr/bin/env python3
"""
generate_env.py — Interactive generator for production .env files.

Generates:
  - db.env       (MariaDB credentials)
  - api.env      (FastAPI settings + DB credentials)
  - front.env    (Next.js / NextAuth settings)

Run:
    python generate_env.py
"""

import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ─── Colours ──────────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RED    = "\033[91m"
DIM    = "\033[2m"

def c(color: str, text: str) -> str:
    return f"{color}{text}{RESET}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def prompt(label: str, default: str = "", secret: bool = False) -> str:
    """Prompt the user for input, with an optional default value."""
    hint = f" [{c(DIM, default)}]" if default else ""
    if secret and default:
        hint = f" [{c(DIM, '(generated)')}]"

    import getpass
    try:
        if secret:
            raw = getpass.getpass(f"  {label}{hint}: ")
        else:
            raw = input(f"  {label}{hint}: ")
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)

    return raw.strip() or default


def section(title: str) -> None:
    print(f"\n{c(BOLD, c(CYAN, f'── {title} '))}")


def success(msg: str) -> None:
    print(f"  {c(GREEN, '✓')} {msg}")


def warn(msg: str) -> None:
    print(f"  {c(YELLOW, '!')} {msg}")


def write_env(path: Path, lines: list[str], overwrite_prompt: bool = True) -> None:
    if path.exists() and overwrite_prompt:
        ans = input(f"\n  {c(YELLOW, '!')} {path.name} already exists. Overwrite? [y/N] ").strip().lower()
        if ans != "y":
            print(f"  {c(DIM, f'Skipping {path.name}')}.")
            return
    content = "\n".join(lines) + "\n"
    path.write_text(content, encoding="utf-8")
    success(f"Written → {c(BOLD, str(path))}")


# ─── Secret generators ────────────────────────────────────────────────────────

def gen_hex(length: int = 64) -> str:
    """Equivalent to `openssl rand -hex <length>`."""
    return secrets.token_hex(length)


def gen_base64(length: int = 32) -> str:
    """URL-safe base64 secret (used by NextAuth)."""
    import base64
    return base64.urlsafe_b64encode(secrets.token_bytes(length)).rstrip(b"=").decode()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"\n{c(BOLD, '=== Mawster — Production .env Generator ===')}")
    print(c(DIM, f"  Output directory: {ROOT}\n"))

    # ── 1. Database ───────────────────────────────────────────────────────────
    section("Database (db.env + api.env)")

    db_name     = prompt("Database name",     default="mawster")
    db_user     = prompt("DB username",       default="mawster")
    db_password = prompt("DB password",       default=gen_hex(16), secret=True)
    db_root_pw  = prompt("DB root password",  default=gen_hex(16), secret=True)
    db_port     = prompt("DB port",           default="3306")

    # ── 2. Discord OAuth ──────────────────────────────────────────────────────
    section("Discord OAuth (https://discord.com/developers/applications)")

    discord_client_id     = prompt("DISCORD_CLIENT_ID")
    discord_client_secret = prompt("DISCORD_CLIENT_SECRET", secret=True)

    if not discord_client_id or not discord_client_secret:
        warn("Discord credentials left empty — front.env will have placeholder values.")

    # ── 3. Domain / NextAuth ─────────────────────────────────────────────────
    section("Domain & NextAuth")

    domain = prompt("Domain (e.g. example.com, or IP address)", default="localhost")
    scheme = "http" if domain in ("localhost", "127.0.0.1") or ":" in domain else "https"
    default_url = f"{scheme}://{domain}"
    nextauth_url    = prompt("NEXTAUTH_URL", default=default_url)
    nextauth_secret = gen_base64(32)
    print(f"  NEXTAUTH_SECRET  [{c(DIM, '(auto-generated)')}]")

    # ── 4. API settings ────────────────────────────────────────────────────────
    section("API settings")

    api_secret_key     = gen_hex(64)
    print(f"  SECRET_KEY            [{c(DIM, '(auto-generated)')}]")
    algo               = prompt("JWT algorithm",                  default="HS256")
    bcrypt_rounds      = prompt("Bcrypt hash rounds",             default="12")
    token_expire       = prompt("Access token expiry (minutes)",  default="60")

    # ── 5. Write files ─────────────────────────────────────────────────────────
    print(f"\n{c(BOLD, '── Writing files ──────────────────────────────────')}")

    # db.env
    write_env(ROOT / "db.env", [
        f"MARIADB_USER={db_user}",
        f"MARIADB_PASSWORD={db_password}",
        f"MARIADB_ROOT_PASSWORD={db_root_pw}",
        f"MARIADB_PORT={db_port}",
        f"MARIADB_DATABASE={db_name}",
    ])

    # api.env
    write_env(ROOT / "api.env", [
        f"SECRET_KEY={api_secret_key}",
        f"MARIADB_USER={db_user}",
        f"MARIADB_PASSWORD={db_password}",
        f"MARIADB_ROOT_PASSWORD={db_root_pw}",
        f"MARIADB_PORT={db_port}",
        f"MARIADB_DATABASE={db_name}",
        f"ALGORITHM={algo}",
        f"BCRYPT_HASH_ROUND={bcrypt_rounds}",
        f"ACCESS_TOKEN_EXPIRE_MINUTES={token_expire}",
    ])

    # front.env
    write_env(ROOT / "front.env", [
        f"NEXTAUTH_SECRET={nextauth_secret}",
        f"NEXTAUTH_URL={nextauth_url}",
        f"DISCORD_CLIENT_ID={discord_client_id or 'PASTE_FROM_DISCORD_DEVELOPER_PORTAL'}",
        f"DISCORD_CLIENT_SECRET={discord_client_secret or 'PASTE_FROM_DISCORD_DEVELOPER_PORTAL'}",
    ])

    # ── 6. Summary ─────────────────────────────────────────────────────────────
    print(f"\n{c(BOLD, '── Done ───────────────────────────────────────────')}")
    print(f"""
  {c(BOLD, 'Next steps:')}

  1. {c(CYAN, 'Deploy:')}
       export DOMAIN={domain}
       docker compose -f compose.prod.yaml up -d

  2. {c(CYAN, 'IP-only / no TLS (temporary):')}
       export DOMAIN=:80
       docker compose -f compose.prod.yaml up -d

  3. {c(YELLOW, 'Keep your .env files out of Git!')}
       They are already in .gitignore (*.env).
""")


if __name__ == "__main__":
    main()
