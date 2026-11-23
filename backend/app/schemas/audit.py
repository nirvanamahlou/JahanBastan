"""Privacy-minimised read models for the administrative activity feed."""

from datetime import datetime
from typing import Literal

from pydantic import ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.schemas.admin import AdminSchema


class AdminAuditEventRead(AdminSchema):
    """One immutable operational event with no customer payload."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    source: Literal["cart", "booking", "lead"]
    entity_type: Literal["cart", "booking", "lead"]
    entity_id: int
    actor_name: str
    action: str
    from_status: str | None = None
    to_status: str | None = None
    occurred_at: datetime


class AdminAuditEventListResponse(AdminSchema):
    """Bounded newest-first activity feed for super administrators."""

    items: list[AdminAuditEventRead] = Field(default_factory=list)


class AdminLoginEventRead(AdminSchema):
    """One successful administrator login derived from a revocable session."""

    id: int
    admin_user_id: int | None
    actor_name: str
    email: str
    role: Literal["super_admin", "admin", "editor", "deleted"]
    status: Literal["active", "expired", "revoked"]
    logged_in_at: datetime
    last_seen_at: datetime | None = None
    expires_at: datetime
    revoked_at: datetime | None = None


class AdminLoginEventListResponse(AdminSchema):
    """Bounded newest-first successful login history for super administrators."""

    items: list[AdminLoginEventRead] = Field(default_factory=list)
