"""Bearer authentication and independent HMAC request authentication."""

import hashlib
import hmac
import re
import time
from dataclasses import dataclass
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.nora.contracts import CONTRACT, SITE_ID
from app.integrations.nora.models import NoraConnection
from app.integrations.nora.repository import NoraRepository
from app.models import AdminUser


def cipher() -> Fernet:
    """Require a dedicated, durable deployment key; no ephemeral fallback."""
    value = get_settings().NORA_CONNECTOR_ENCRYPTION_KEY
    try:
        return Fernet(value.get_secret_value().encode() if value else b"")
    except (ValueError, TypeError) as exc:
        raise HTTPException(503, "connector encryption is not configured") from exc


def key_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@dataclass(frozen=True)
class NoraContext:
    """Only server-verified personal claims enter domain commands."""

    connection_id: str
    branch: str
    subject: str
    admin_id: int
    body: bytes
    command: str
    version: str


def valid_connection(connection: NoraConnection | None) -> NoraConnection:
    from datetime import UTC, datetime

    if (
        connection is None
        or connection.site_id != SITE_ID
        or connection.environment != get_settings().APP_ENV
        or connection.revoked_at is not None
        or connection.deleted_at is not None
        or connection.expires_at <= datetime.now(UTC)
    ):
        raise HTTPException(401, "connection is unavailable")
    return connection


async def authenticate(request: Request, session: AsyncSession) -> NoraContext:
    """Authenticate, consume a nonce durably, and resolve a personal site user."""
    if request.headers.get("origin") or request.headers.get("sec-fetch-site"):
        raise HTTPException(403, "server-to-server request required")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(413, "request too large")
    headers = request.headers
    connection_id = headers.get("x-nora-connection", "")
    authorization = headers.get("authorization", "")
    subject = headers.get("x-nora-subject", "")
    branch = headers.get("x-nora-branch", "")
    timestamp = headers.get("x-nora-timestamp", "")
    nonce = headers.get("x-nora-request", "")
    command = headers.get("idempotency-key", "")
    version = headers.get("x-nora-version", "")
    try:
        UUID(subject)
        UUID(branch)
        if (
            not re.fullmatch(r"[a-f0-9]{32}", connection_id)
            or not re.fullmatch(r"Bearer [A-Za-z0-9_-]{64}", authorization)
            or not re.fullmatch(r"\d{10}", timestamp)
            or abs(time.time() - int(timestamp)) > 300
            or not re.fullmatch(r"[a-f0-9]{32}", nonce)
            or (command and not re.fullmatch(r"[A-Za-z0-9_-]{16,80}", command))
            or (version and not re.fullmatch(r"\d{1,20}", version))
        ):
            raise ValueError()
    except (ValueError, TypeError) as exc:
        raise HTTPException(401, "invalid authentication context") from exc
    repository = NoraRepository(session)
    control = request.method == "POST" and request.url.path.endswith(
        "/nora/v1/lifecycle"
    )
    connection = await repository.connection(connection_id)
    if not control:
        connection = valid_connection(connection)
    elif (
        connection is None
        or connection.site_id != SITE_ID
        or connection.environment != get_settings().APP_ENV
    ):
        raise HTTPException(401, "connection is unavailable")
    issuer = await session.get(AdminUser, connection.issuer_id)
    if not control and (
        issuer is None
        or not issuer.is_active
        or issuer.role not in {"admin", "super_admin"}
    ):
        raise HTTPException(403, "delegation issuer is disabled")
    if not hmac.compare_digest(key_hash(authorization[7:]), connection.key_hash):
        raise HTTPException(401, "invalid credential")
    path = request.url.path
    if request.url.query:
        path += "?" + request.url.query
    canonical = "\n".join(
        (
            CONTRACT,
            connection.id,
            connection.site_id,
            connection.organization_id,
            connection.environment,
            branch,
            subject,
            request.method,
            path,
            timestamp,
            nonce,
            command,
            version,
            hashlib.sha256(raw).hexdigest(),
        )
    )
    try:
        signing_key = cipher().decrypt(connection.signing_ciphertext.encode())
    except InvalidToken as exc:
        raise HTTPException(503, "connector secret unavailable") from exc
    signature = hmac.new(signing_key, canonical.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, headers.get("x-nora-signature", "")):
        raise HTTPException(401, "invalid signature")
    minute = int(time.time()) // 60
    if connection.rate_minute != minute:
        connection.rate_minute, connection.rate_count = minute, 0
    if connection.rate_count >= 120:
        raise HTTPException(429, "connection rate limit exceeded")
    connection.rate_count += 1
    try:
        await repository.remember_nonce(connection.id, nonce)
        # Only the signed subject establishes identity; ignore unsigned name hints.
        user = await repository.personal_admin(connection, branch, subject, "")
        if not control and (
            not user.is_active or user.role not in {"admin", "super_admin"}
        ):
            raise HTTPException(403, "personal site identity is disabled")
        admin_id = user.id
        repository.audit(connection.id, subject, "request." + request.method.lower())
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "request replay rejected") from exc
    return NoraContext(
        connection_id, branch, subject, admin_id, bytes(raw), command, version
    )
