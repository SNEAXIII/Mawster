import hashlib

from src.security.secrets import SECRET


def hash_email(email: str) -> str:
    """Hash an email with PBKDF2-HMAC-SHA256 + pepper. Deterministic for lookup."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        email.strip().lower().encode(),
        SECRET.EMAIL_PEPPER.encode(),
        200_000,
    ).hex()
