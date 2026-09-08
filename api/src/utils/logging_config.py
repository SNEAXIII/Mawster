"""Centralized logging configuration — RGPD-compliant.

This module sets up file-based logging for audit trails. To comply with RGPD:
  - We log user IDs (UUIDs) but NEVER personal data (email, login, IP, etc.)
  - We log action types, resource IDs, and timestamps
  - Logs are written to rotating files under `logs/` directory
  - Retention: 90 days (files auto-rotate at 10 MB, keep 10 backups)

Usage:
    from src.utils.logging_config import setup_logging
    setup_logging()  # call once at startup in main.py

    # In any module:
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Something happened")

    # For audit events, use the dedicated audit logger:
    from src.utils.logging_config import audit_log
    audit_log("alliance.create", user_id=str(user.id), detail="alliance_id=xxx")
"""

import logging
import logging.handlers
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
APP_LOG_FILE = LOG_DIR / "app.log"
AUDIT_LOG_FILE = LOG_DIR / "audit.log"

MAX_BYTES = 10 * 1024 * 1024  # 10 MB per file
BACKUP_COUNT = 10  # keep 10 rotated files

DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def _build_formats() -> tuple[str, str]:
    port = os.getenv("PORT", "")
    prefix = f"[:{port}] " if port else ""
    return (
        f"%(asctime)s | %(levelname)-8s | {prefix}%(name)s | %(message)s",
        f"%(asctime)s | AUDIT | {prefix}%(message)s",
    )


LOG_FORMAT, AUDIT_FORMAT = _build_formats()


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger with console + rotating file handlers.

    Call this once from main.py before the app starts.
    """
    # Only local development writes log files. Everywhere else — prod and staging, where
    # Docker owns rotation and retention, and the test suite, where every xdist worker
    # would open the same RotatingFileHandler and race the others' rotations — the app
    # logs to stdout and nothing else.
    is_dev = os.getenv("MODE", "dev") == "dev"

    # Root logger
    root = logging.getLogger()
    root.setLevel(level)

    # Avoid duplicate handlers on reload
    if root.handlers:
        return

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # Console handler always present (useful for docker logs)
    console = logging.StreamHandler()
    console.setLevel(level)
    console.setFormatter(formatter)
    root.addHandler(console)

    if is_dev:
        LOG_DIR.mkdir(parents=True, exist_ok=True)

        # Rotating file handler — general app logs
        file_handler = logging.handlers.RotatingFileHandler(
            str(APP_LOG_FILE),
            maxBytes=MAX_BYTES,
            backupCount=BACKUP_COUNT,
            encoding="utf-8",
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)

    # ---------------------------------------------------------------------------
    # Audit logger (separate logger for RGPD-safe events)
    # ---------------------------------------------------------------------------
    audit_logger = logging.getLogger("audit")
    audit_logger.setLevel(logging.INFO)
    audit_logger.propagate = False  # don't duplicate into root/app log

    audit_formatter = logging.Formatter(AUDIT_FORMAT, datefmt=DATE_FORMAT)

    if not is_dev:
        # Same rule as the app log: stdout only, and let the platform collect it.
        audit_handler = logging.StreamHandler()
        audit_handler.setLevel(logging.INFO)
        audit_handler.setFormatter(audit_formatter)
        audit_logger.addHandler(audit_handler)
    else:
        # File-based audit handler
        audit_handler = logging.handlers.RotatingFileHandler(
            str(AUDIT_LOG_FILE),
            maxBytes=MAX_BYTES,
            backupCount=BACKUP_COUNT,
            encoding="utf-8",
        )
        audit_handler.setLevel(logging.INFO)
        audit_handler.setFormatter(audit_formatter)
        audit_logger.addHandler(audit_handler)

        # `audit` does not propagate, so without this the events would only ever reach
        # the file and never the terminal the developer is watching.
        audit_console = logging.StreamHandler()
        audit_console.setLevel(logging.INFO)
        audit_console.setFormatter(audit_formatter)
        audit_logger.addHandler(audit_console)

    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("watchfiles.main").setLevel(logging.WARNING)
    # These libraries narrate every low-level step at DEBUG and drown the app's
    # own output: botocore/aiobotocore sign every S3 call (~40 lines per crop),
    # aio_pika/aiormq log every AMQP frame. INFO keeps their meaningful lines
    # (the consumer's "listening on ..." survives) without the frame-by-frame noise.
    for noisy in ("botocore", "aiobotocore", "boto3", "aio_pika", "aiormq"):
        logging.getLogger(noisy).setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Audit helper
# ---------------------------------------------------------------------------

_audit = logging.getLogger("audit")


def audit_log(event: str, *, user_id: str = "anonymous", detail: str = "") -> None:
    """Write a RGPD-safe audit event.

    Args:
        event:   Action name, e.g. "auth.login", "alliance.create", "roster.bulk_import"
        user_id: UUID string of the user performing the action (never email/login)
        detail:  Additional context (resource IDs only, never personal data)
    """
    parts = [f"event={event}", f"user_id={user_id}"]
    if detail:
        parts.append(f"detail={detail}")
    _audit.info(" | ".join(parts))
