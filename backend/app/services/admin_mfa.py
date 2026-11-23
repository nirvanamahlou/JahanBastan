"""Time-based one-time passwords with encrypted secret storage."""

from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time
from secrets import token_bytes
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings


def _cipher(settings: Settings) -> Fernet:
    key = settings.ADMIN_MFA_ENCRYPTION_KEY
    if key is None:
        raise ValueError("administrator MFA encryption is not configured")
    try:
        return Fernet(key.get_secret_value().encode("ascii"))
    except (ValueError, TypeError) as exc:
        raise ValueError("administrator MFA encryption key is invalid") from exc


def generate_secret() -> str:
    return base64.b32encode(token_bytes(20)).decode("ascii").rstrip("=")


def encrypt_secret(secret: str, settings: Settings) -> str:
    return _cipher(settings).encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_secret(ciphertext: str, settings: Settings) -> str:
    try:
        return _cipher(settings).decrypt(ciphertext.encode("ascii")).decode("ascii")
    except InvalidToken as exc:
        raise ValueError("administrator MFA secret cannot be decrypted") from exc


def _totp(secret: str, counter: int) -> str:
    padding = "=" * (-len(secret) % 8)
    key = base64.b32decode(secret + padding, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{number % 1_000_000:06d}"


def verify_code(secret: str, code: str, *, at_time: int | None = None) -> bool:
    if len(code) != 6 or not code.isdigit():
        return False
    counter = (int(time.time()) if at_time is None else at_time) // 30
    return any(
        hmac.compare_digest(_totp(secret, counter + drift), code)
        for drift in (-1, 0, 1)
    )


def provisioning_uri(secret: str, *, email: str, issuer: str) -> str:
    label = quote(f"{issuer}:{email}", safe="")
    return (
        f"otpauth://totp/{label}?secret={secret}"
        f"&issuer={quote(issuer, safe='')}&algorithm=SHA1&digits=6&period=30"
    )
