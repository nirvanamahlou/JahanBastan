"""Super-admin customer account management endpoints."""

from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.api.dependencies.auth import DatabaseSession, SuperAdmin
from app.repositories.customer_accounts import CustomerUserRepository
from app.schemas.admin import CustomerFileRead, CustomerUserListResponse
from app.services.customer_file_export import create_customer_file_xlsx

router = APIRouter(prefix="/admin/customers", tags=["admin-customers"])


@router.get("", response_model=CustomerUserListResponse)
async def list_customer_users(
    session: DatabaseSession,
    _super_admin: SuperAdmin,
    query: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=100, alias="pageSize")] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CustomerUserListResponse:
    """Return a bounded, privacy-minimised customer account list."""
    users, total = await CustomerUserRepository(session).list_for_admin(
        query=query,
        limit=limit,
        offset=offset,
    )
    return CustomerUserListResponse(
        items=users,
        total=total,
        limit=limit,
        offset=offset,
    )


async def _customer_file_or_404(
    customer_id: int, session: DatabaseSession
) -> CustomerFileRead:
    data = await CustomerUserRepository(session).get_file_for_admin(customer_id)
    if data is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="پرونده مشتری پیدا نشد")
    return CustomerFileRead.model_validate(data)


@router.get("/{customer_id}/export.xlsx")
async def export_customer_file(
    customer_id: int,
    session: DatabaseSession,
    _super_admin: SuperAdmin,
) -> StreamingResponse:
    """Download one customer's customer-service file as a multi-sheet workbook."""
    profile = await _customer_file_or_404(customer_id, session)
    content = create_customer_file_xlsx(profile)
    return StreamingResponse(
        BytesIO(content),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="customer-file-{profile.id}.xlsx"'
            )
        },
    )


@router.get("/{customer_id}", response_model=CustomerFileRead)
async def get_customer_file(
    customer_id: int, session: DatabaseSession, _super_admin: SuperAdmin
) -> CustomerFileRead:
    return await _customer_file_or_404(customer_id, session)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_customer_from_admin_list(
    customer_id: int,
    session: DatabaseSession,
    _super_admin: SuperAdmin,
) -> None:
    """Hide a customer from the administrative customer list without deleting data."""
    archived = await CustomerUserRepository(session).archive_for_admin(customer_id)
    if not archived:
        raise HTTPException(status_code=404, detail="customer not found")
    await session.commit()
