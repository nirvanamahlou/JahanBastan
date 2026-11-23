"""Connector-owned persistence, isolated from commercial data."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.content import TimestampMixin

Json = JSON().with_variant(JSONB, "postgresql")


class NoraInstallation(Base):
    """Persistent organization identity, independent of host, key and legal issuer."""

    __tablename__ = "nora_installation"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(String(36), unique=True)
    tracking_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )


class NoraConnection(TimestampMixin, Base):
    """Revocable, expiring delegation. Bearer key is never stored plaintext."""

    __tablename__ = "nora_connections"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    site_id: Mapped[str] = mapped_column(String(40))
    organization_id: Mapped[str] = mapped_column(String(36))
    environment: Mapped[str] = mapped_column(String(20))
    nora_origin: Mapped[str] = mapped_column(String(2048))
    key_hash: Mapped[str] = mapped_column(String(64))
    signing_ciphertext: Mapped[str] = mapped_column(Text)
    resources: Mapped[list[str]] = mapped_column(Json)
    issuer_id: Mapped[int] = mapped_column(ForeignKey("admin_users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    renewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    rate_minute: Mapped[int] = mapped_column(Integer, default=0)
    rate_count: Mapped[int] = mapped_column(Integer, default=0)


class NoraActor(Base):
    """An independent personal site identity for a Nora branch/subject."""

    __tablename__ = "nora_actors"
    connection_id: Mapped[str] = mapped_column(
        ForeignKey("nora_connections.id"), primary_key=True
    )
    branch_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    subject: Mapped[str] = mapped_column(String(36), primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("admin_users.id"), unique=True)


class NoraOperation(Base):
    """Transactionally persisted command result and payload fingerprint."""

    __tablename__ = "nora_operations"
    connection_id: Mapped[str] = mapped_column(
        ForeignKey("nora_connections.id"), primary_key=True
    )
    operation_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict[str, Any]] = mapped_column(Json)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NoraNonce(Base):
    """Database-unique signed request IDs prevent replay across workers/restarts."""

    __tablename__ = "nora_nonces"
    connection_id: Mapped[str] = mapped_column(
        ForeignKey("nora_connections.id"), primary_key=True
    )
    request_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class NoraPreview(Base):
    """Encrypted workbook and source revision; only the owning actor may apply."""

    __tablename__ = "nora_previews"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("nora_connections.id"))
    branch_id: Mapped[str] = mapped_column(String(36))
    subject: Mapped[str] = mapped_column(String(36))
    kind: Mapped[str] = mapped_column(String(20))
    source_revision: Mapped[str] = mapped_column(String(64))
    ciphertext: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NoraAudit(Base):
    """Append-only safe connector audit; never records request bodies/secrets."""

    __tablename__ = "nora_audit"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("nora_connections.id"))
    actor: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NoraPresence(Base):
    """Expiring anonymous browser hash; no URLs, IP, cookie or user identity."""

    __tablename__ = "nora_presence"
    browser_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(30))
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class NoraPageView(Base):
    """Deduplicated anonymous navigation event, never reconstructed history."""

    __tablename__ = "nora_page_views"
    event_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    browser_hash: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
