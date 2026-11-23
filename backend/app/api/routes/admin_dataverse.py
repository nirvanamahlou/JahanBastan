"""Super-admin visibility into Dataverse setup without exposing credentials."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.dependencies.auth import SuperAdmin
from app.core.config import get_settings
from app.integrations.dataverse.mapping import (
    REQUIRED_TABLE_KEYS,
    DataverseMappingError,
    configuration_gaps,
    load_dataverse_mapping,
)

router = APIRouter(prefix="/admin/integrations/dataverse", tags=["admin-dataverse"])


class DataverseStatusResponse(BaseModel):
    """Safe integration readiness data suitable for the management panel."""

    enabled: bool
    ready: bool
    auth_method: str
    api_version: str
    write_scope_enabled: bool
    missing_settings: list[str]
    mapping_error: str | None
    entity_readiness: dict[str, bool]


@router.get("/status", response_model=DataverseStatusResponse)
async def dataverse_status(_super_admin: SuperAdmin) -> DataverseStatusResponse:
    """Report configuration readiness; this endpoint never calls Dataverse."""
    settings = get_settings()
    mapping_error: str | None = None
    entity_readiness = {key: False for key in REQUIRED_TABLE_KEYS}
    try:
        mapping = load_dataverse_mapping(settings.DATAVERSE_MAPPING_FILE)
        if mapping is not None:
            entity_readiness.update(mapping.readiness())
    except DataverseMappingError as exc:
        mapping_error = str(exc)

    missing_settings = configuration_gaps(settings)
    ready = (
        settings.DATAVERSE_ENABLED
        and not missing_settings
        and mapping_error is None
        and all(entity_readiness.values())
    )
    return DataverseStatusResponse(
        enabled=settings.DATAVERSE_ENABLED,
        ready=ready,
        auth_method=settings.DATAVERSE_AUTH_METHOD,
        api_version=settings.DATAVERSE_API_VERSION,
        write_scope_enabled=settings.DATAVERSE_ALLOW_REQUEST_ORDER_WRITE,
        missing_settings=missing_settings,
        mapping_error=mapping_error,
        entity_readiness=entity_readiness,
    )
