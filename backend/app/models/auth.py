"""Authentication persistence models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.content import AdminUser, CustomerUser


class AdminSession(Base):
    """Revocable server-side session for an administrative user."""

    __tablename__ = "admin_sessions"
    __table_args__ = (
        Index("idx_admin_sessions_token_hash", "token_hash", unique=True),
        Index("idx_admin_sessions_created", "created_at", "id"),
        Index(
            "idx_admin_sessions_expiry",
            "expires_at",
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    admin_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    user: Mapped[AdminUser | None] = relationship(
        back_populates="sessions",
        lazy="raise",
    )


class AdminPasswordResetCode(Base):
    """Single-use, short-lived code for recovering an administrator password."""

    __tablename__ = "admin_password_reset_codes"
    __table_args__ = (
        Index(
            "idx_admin_password_reset_codes_active",
            "admin_user_id",
            "expires_at",
            postgresql_where=text("used_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(
        ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    attempts: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default=text("0")
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class AdminMfaCredential(Base):
    """Encrypted TOTP seed for one administrative account."""

    __tablename__ = "admin_mfa_credentials"
    __table_args__ = (
        Index("idx_admin_mfa_credentials_admin_user", "admin_user_id", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(
        ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False
    )
    secret_ciphertext: Mapped[str] = mapped_column(String(512), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class CustomerSession(Base):
    """Revocable server-side session for a public customer."""

    __tablename__ = "customer_sessions"
    __table_args__ = (
        Index("idx_customer_sessions_token_hash", "token_hash", unique=True),
        Index(
            "idx_customer_sessions_expiry",
            "expires_at",
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_user_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    user: Mapped[CustomerUser] = relationship(
        back_populates="sessions",
        lazy="raise",
    )


class CustomerPasswordResetToken(Base):
    """Single-use, time-limited password reset token for a public customer."""

    __tablename__ = "customer_password_reset_tokens"
    __table_args__ = (
        Index("idx_customer_password_reset_tokens_hash", "token_hash", unique=True),
        Index(
            "idx_customer_password_reset_tokens_active",
            "customer_user_id",
            "expires_at",
            postgresql_where=text("used_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_user_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class CustomerSmsLoginCode(Base):
    """Short-lived, single-use login code stored only as an Argon2 hash."""

    __tablename__ = "customer_sms_login_codes"
    __table_args__ = (
        Index(
            "idx_customer_sms_login_codes_active",
            "phone",
            "expires_at",
            postgresql_where=text("used_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    attempts: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default=text("0")
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
