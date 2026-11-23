"""Liveness and readiness endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

router = APIRouter(tags=["health"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


class HealthResponse(BaseModel):
    """Machine-readable service health."""

    status: str


@router.get("/health/live", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    """Confirm that the process and event loop are running."""
    return HealthResponse(status="ok")


@router.get("/health/ready", response_model=HealthResponse)
async def readiness(session: DatabaseSession) -> HealthResponse:
    """Confirm that the API can reach PostgreSQL."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        ) from exc
    return HealthResponse(status="ok")
