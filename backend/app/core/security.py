"""Password and session-token security primitives."""

import hashlib
import secrets

from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

password_hasher = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hasher.hash("not-a-real-admin-password")


def hash_password(password: str) -> str:
    """Hash a password with the recommended Argon2 configuration."""
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password without exposing comparison timing."""
    try:
        return password_hasher.verify(password, password_hash)
    except (TypeError, UnknownHashError, ValueError):
        # Malformed legacy hashes must behave like invalid credentials instead
        # of turning the public login endpoint into a server error.
        return False


def generate_session_token() -> str:
    """Generate a cryptographically secure opaque session token."""
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Create the non-reversible database representation of a session token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
