"""Authentication, authorization, and browser-origin dependencies."""

from datetime import UTC, datetime, timedelta
from hmac import compare_digest
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_session_token
from app.db.session import get_session
from app.models import AdminUser, CustomerUser
from app.repositories.admin_users import AdminSessionRepository
from app.repositories.customer_accounts import CustomerSessionRepository

settings = get_settings()
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


def require_trusted_origin(request: Request) -> None:
    """Reject unsafe cross-site requests, including requests with a missing Origin."""
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin")
    if origin is not None and origin in settings.CORS_ALLOWED_ORIGINS:
        return
    if settings.APP_ENV in {"development", "test"} and origin is None:
        return
    requested_with = request.headers.get("x-requested-with", "")
    fetch_site = request.headers.get("sec-fetch-site", "")
    same_site_proxy = compare_digest(
        requested_with, "XMLHttpRequest"
    ) and fetch_site in {"same-origin", "same-site", "none", ""}
    if not same_site_proxy:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="untrusted request origin",
        )


async def get_current_admin(
    request: Request,
    session: DatabaseSession,
) -> AdminUser:
    """Resolve the active administrator represented by the session cookie."""
    token = request.cookies.get(settings.ADMIN_SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )

    admin_session = await AdminSessionRepository(session).get_active(
        hash_session_token(token),
        idle_minutes=settings.ADMIN_SESSION_IDLE_MINUTES,
    )
    if (
        admin_session is None
        or admin_session.user is None
        or not admin_session.user.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    now = datetime.now(UTC)
    last_seen = admin_session.last_seen_at or admin_session.created_at
    if last_seen < now - timedelta(minutes=5):
        await AdminSessionRepository(session).touch(admin_session.id)
        await session.commit()
    return admin_session.user


CurrentAdmin = Annotated[AdminUser, Depends(get_current_admin)]


async def require_admin_manager(current_admin: CurrentAdmin) -> AdminUser:
    """Allow administrators who may access operational and customer data."""
    if current_admin.role not in {"super_admin", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="administrator role required",
        )
    return current_admin


AdminManager = Annotated[AdminUser, Depends(require_admin_manager)]


async def get_current_customer(
    request: Request,
    session: DatabaseSession,
) -> CustomerUser:
    """Resolve the active public customer represented by its session cookie."""
    token = request.cookies.get(settings.CUSTOMER_SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    customer_session = await CustomerSessionRepository(session).get_active(
        hash_session_token(token)
    )
    if customer_session is None or not customer_session.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    return customer_session.user


CurrentCustomer = Annotated[CustomerUser, Depends(get_current_customer)]


async def require_super_admin(current_admin: CurrentAdmin) -> AdminUser:
    """Allow only active super administrators."""
    if current_admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="super administrator role required",
        )
    return current_admin


SuperAdmin = Annotated[AdminUser, Depends(require_super_admin)]


async def require_pricing_admin(current_admin: CurrentAdmin) -> AdminUser:
    """Allow super admins and admins explicitly granted pricing management."""
    if current_admin.role != "super_admin" and not (
        current_admin.role in {"admin", "editor"} and current_admin.can_manage_pricing
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="pricing management permission required",
        )
    return current_admin


PricingAdmin = Annotated[AdminUser, Depends(require_pricing_admin)]
TrustedOrigin = Annotated[None, Depends(require_trusted_origin)]
