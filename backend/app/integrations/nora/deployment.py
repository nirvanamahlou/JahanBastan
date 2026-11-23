"""Non-secret connector readiness shared by status and credential issuance."""

from typing import Any

from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.core.config import Settings, get_settings
from app.core.public_origin import public_origin


def readiness(settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    issues: list[str] = []
    canonical: str | None = None
    try:
        canonical = public_origin(
            settings.PUBLIC_SITE_URL, allow_test_loopback=settings.APP_ENV == "test"
        )
    except ValueError:
        issues.append("PUBLIC_HTTPS_ORIGIN_REQUIRED")
    isolated_test = (
        settings.APP_ENV == "test"
        and canonical is not None
        and canonical.startswith(("http://127.0.0.1", "http://localhost"))
    )
    if settings.APP_ENV not in {"production", "staging"} and not isolated_test:
        issues.append("DEPLOYED_ENVIRONMENT_REQUIRED")
    key = settings.NORA_CONNECTOR_ENCRYPTION_KEY
    try:
        Fernet(key.get_secret_value().encode() if key else b"")
    except (ValueError, TypeError):
        issues.append("PERSISTENT_ENCRYPTION_KEY_REQUIRED")
    return {
        "ready": not issues,
        "issues": issues,
        "origin": canonical,
        "apiBase": "/api/v1/integration/nora/v1",
    }


def require_ready() -> dict[str, Any]:
    state = readiness()
    if not state["ready"]:
        raise HTTPException(
            503,
            {"code": "NORA_DEPLOYMENT_NOT_READY", "issues": state["issues"]},
        )
    return state
