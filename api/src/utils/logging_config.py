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

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
AUDIT_FORMAT = "%(asctime)s | AUDIT | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger with console + rotating file handlers.

    Call this once from main.py before the app starts.
    """
    # Detect whether we're running inside a container environment. In container
    # mode we prefer logging to stdout/stderr only and let Docker handle
    # rotation/retention (avoids duplicate file logs).
    CONTAINER_MODE = os.getenv("CONTAINER") == "1"

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

    if not CONTAINER_MODE:
        # In non-container mode create logs directory and add rotating file handler
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

    if CONTAINER_MODE:
        # In container mode, send audit events to the same console
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

        # Also echo audit events to the console in non-prod
        if os.getenv("MODE") != "prod":
            audit_console = logging.StreamHandler()
            audit_console.setLevel(logging.INFO)
            audit_console.setFormatter(audit_formatter)
            audit_logger.addHandler(audit_console)

    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


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
