"""Restricted reviewer endpoints for customer visa applications."""

from fastapi import APIRouter, HTTPException
from starlette.responses import FileResponse

from app.api.dependencies.auth import CurrentAdmin, DatabaseSession, TrustedOrigin
from app.core.config import get_settings
from app.repositories.visa_applications import VisaApplicationRepository
from app.schemas.account import VisaApplicationAdminRead, VisaApplicationStatusUpdate
from app.services.private_storage import private_download_response

router = APIRouter(prefix="/admin/visa-applications", tags=["admin-visa-applications"])
settings = get_settings()


def require_reviewer(admin: CurrentAdmin) -> None:
    if admin.role not in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="reviewer role required")


@router.get("", response_model=list[VisaApplicationAdminRead])
async def list_visa_applications(
    session: DatabaseSession,
    admin: CurrentAdmin,
) -> list[VisaApplicationAdminRead]:
    require_reviewer(admin)
    applications, _total = await VisaApplicationRepository(session).list_for_admin(
        status=None, limit=100, offset=0
    )
    return [VisaApplicationAdminRead.model_validate(item) for item in applications]


@router.patch("/{application_id}", response_model=VisaApplicationAdminRead)
async def update_visa_application(
    application_id: int,
    payload: VisaApplicationStatusUpdate,
    session: DatabaseSession,
    admin: CurrentAdmin,
    _trusted_origin: TrustedOrigin,
) -> VisaApplicationAdminRead:
    require_reviewer(admin)
    application = await VisaApplicationRepository(session).get_for_admin(application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="visa application not found")
    application.status = payload.status
    application.customer_message = payload.customer_message
    application.internal_note = payload.internal_note
    application.reviewed_by_admin_id = admin.id
    await session.commit()
    refreshed = await VisaApplicationRepository(session).get_for_admin(application_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="visa application not found")
    return VisaApplicationAdminRead.model_validate(refreshed)


@router.get("/{application_id}/documents/{document_id}")
async def download_visa_document(
    application_id: int,
    document_id: int,
    session: DatabaseSession,
    admin: CurrentAdmin,
) -> FileResponse:
    require_reviewer(admin)
    document = await VisaApplicationRepository(session).get_document_for_admin(
        application_id=application_id,
        document_id=document_id,
    )
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    return await private_download_response(
        document.storage_key,
        document.original_name,
        document.mime_type,
        settings,
    )
