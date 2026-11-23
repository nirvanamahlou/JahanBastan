"""Super-admin visibility into existing immutable operational audit trails."""

from fastapi import APIRouter, Query

from app.api.dependencies.auth import DatabaseSession, SuperAdmin
from app.core.config import get_settings
from app.repositories.admin_audit import AdminAuditRepository
from app.schemas.audit import (
    AdminAuditEventListResponse,
    AdminLoginEventListResponse,
)

router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])
settings = get_settings()


@router.get("/events", response_model=AdminAuditEventListResponse)
async def list_audit_events(
    session: DatabaseSession,
    _super_admin: SuperAdmin,
    page_size: int = Query(default=60, ge=1, le=100, alias="pageSize"),
) -> AdminAuditEventListResponse:
    """Return recent sensitive actions without customer payloads."""
    del _super_admin
    items = await AdminAuditRepository(session).list_events(limit=page_size)
    return AdminAuditEventListResponse(items=items)


@router.get("/logins", response_model=AdminLoginEventListResponse)
async def list_login_events(
    session: DatabaseSession,
    _super_admin: SuperAdmin,
    page_size: int = Query(default=60, ge=1, le=100, alias="pageSize"),
) -> AdminLoginEventListResponse:
    """Return successful administrator logins without tokens or device data."""
    del _super_admin
    items = await AdminAuditRepository(session).list_login_events(
        limit=page_size,
        idle_minutes=settings.ADMIN_SESSION_IDLE_MINUTES,
    )
    return AdminLoginEventListResponse(items=items)
