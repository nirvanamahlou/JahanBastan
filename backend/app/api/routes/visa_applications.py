"""Authenticated private visa-application endpoints."""

import asyncio
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from starlette.responses import FileResponse

from app.api.dependencies.auth import CurrentCustomer, DatabaseSession, TrustedOrigin
from app.core.config import get_settings
from app.models import VisaApplicationDocument
from app.repositories.visa_applications import VisaApplicationRepository
from app.schemas.account import (
    VisaApplicationCreate,
    VisaApplicationDocumentRead,
    VisaApplicationRead,
)
from app.services.private_storage import private_download_response, store_private_bytes
from app.services.upload_safety import validate_document_bytes

router = APIRouter(prefix="/account/visa-applications", tags=["visa-applications"])
settings = get_settings()
MAX_VISA_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def serialize(application: object) -> VisaApplicationRead:
    return VisaApplicationRead.model_validate(application)


@router.get("", response_model=list[VisaApplicationRead])
async def list_visa_applications(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[VisaApplicationRead]:
    applications = await VisaApplicationRepository(session).list_for_customer(
        current_customer.id
    )
    return [serialize(item) for item in applications]


@router.post(
    "", response_model=VisaApplicationRead, status_code=status.HTTP_201_CREATED
)
async def create_visa_application(
    payload: VisaApplicationCreate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> VisaApplicationRead:
    application = await VisaApplicationRepository(session).create(
        customer_id=current_customer.id,
        travel_service_id=payload.travel_service_id,
    )
    if application is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "published visa service not found"
        )
    await session.commit()
    application = await VisaApplicationRepository(session).get_for_customer(
        application_id=application.id,
        customer_id=current_customer.id,
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "visa application not found")
    return serialize(application)


@router.post("/{application_id}/submit", response_model=VisaApplicationRead)
async def submit_visa_application(
    application_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> VisaApplicationRead:
    """Submit a complete private draft to the reviewer queue."""
    repository = VisaApplicationRepository(session)
    application = await repository.get_for_customer(
        application_id=application_id,
        customer_id=current_customer.id,
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "visa application not found")
    if application.status not in {"draft", "needs_documents"}:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "visa application is already submitted"
        )
    required_types = set(application.travel_service.visa_document_requirements or [])
    uploaded_types = {document.document_type for document in application.documents}
    missing_types = sorted(required_types - uploaded_types)
    if missing_types:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {
                "message": "required visa documents are missing",
                "missing": missing_types,
            },
        )
    if not application.documents:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "at least one visa document is required",
        )
    application.status = "pending_review"
    await session.commit()
    refreshed = await repository.get_for_customer(
        application_id=application.id,
        customer_id=current_customer.id,
    )
    if refreshed is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "visa application not found")
    return serialize(refreshed)


@router.post(
    "/{application_id}/documents",
    response_model=VisaApplicationDocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_visa_document(
    application_id: int,
    file: Annotated[UploadFile, File()],
    document_type: Annotated[str, Form(min_length=2, max_length=120)],
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> VisaApplicationDocumentRead:
    """Store one bounded document in private storage, never public media."""
    repository = VisaApplicationRepository(session)
    application = await repository.get_for_customer(
        application_id=application_id,
        customer_id=current_customer.id,
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "visa application not found")
    if application.status not in {"draft", "needs_documents"}:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "documents can only be changed before expert review",
        )
    document_type = document_type.strip()
    required_types = application.travel_service.visa_document_requirements or []
    if required_types and document_type not in required_types:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "document type is not required for this visa service",
        )
    extension = ALLOWED_MIME_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "only PDF, JPEG, PNG, and WebP documents are accepted",
        )
    content = await file.read(MAX_VISA_DOCUMENT_BYTES + 1)
    if not content or len(content) > MAX_VISA_DOCUMENT_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "document exceeds 10 MB"
        )
    await asyncio.to_thread(validate_document_bytes, content, extension)

    key = f"visa-documents/{application.id}/{uuid4().hex}{extension}"
    await store_private_bytes(key, content, settings)
    document = VisaApplicationDocument(
        visa_application_id=application.id,
        original_name=(file.filename or f"document{extension}")[:255],
        document_type=document_type,
        storage_key=key,
        mime_type=file.content_type or "application/octet-stream",
        byte_size=len(content),
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return VisaApplicationDocumentRead.model_validate(document)


@router.get("/{application_id}/documents/{document_id}")
async def download_visa_document(
    application_id: int,
    document_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> FileResponse:
    document = await VisaApplicationRepository(session).get_document_for_customer(
        application_id=application_id,
        document_id=document_id,
        customer_id=current_customer.id,
    )
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    return await private_download_response(
        document.storage_key,
        document.original_name,
        document.mime_type,
        settings,
    )
