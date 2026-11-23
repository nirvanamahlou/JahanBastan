"""Shared guards for temporarily disabling customer online sales."""

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SiteSetting


async def require_online_sales_enabled(session: AsyncSession) -> None:
    """Reject new online purchases while preserving existing customer data."""
    settings = await session.get(SiteSetting, 1)
    enabled = (settings.social_links if settings else {}).get("onlineSalesEnabled")
    if enabled != "true":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ثبت سفارش آنلاین موقتاً غیرفعال است.",
        )
