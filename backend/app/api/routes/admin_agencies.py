"""Support workflow for reviewing agencies and assigning purchasing credit."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies.auth import CurrentAdmin, DatabaseSession, TrustedOrigin
from app.repositories.agencies import AgencyRepository
from app.repositories.operations import OperationsRepository
from app.schemas.agency import AgencyAdminRead, AgencyReview

router = APIRouter(prefix="/admin/agencies", tags=["admin-agencies"])


def require_agency_reviewer(admin: CurrentAdmin) -> None:
    if admin.role not in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="reviewer role required")


def serialize_agency(profile: object) -> AgencyAdminRead:
    customer = profile.customer
    return AgencyAdminRead(
        id=profile.id,
        customer_id=profile.customer_id,
        account_email=customer.email,
        account_full_name=customer.full_name,
        legal_name=profile.legal_name,
        registration_number=profile.registration_number,
        national_id=profile.national_id,
        economic_code=profile.economic_code,
        license_number=profile.license_number,
        manager_name=profile.manager_name,
        manager_national_code=profile.manager_national_code,
        phone=profile.phone,
        province=profile.province,
        city=profile.city,
        address=profile.address,
        postal_code=profile.postal_code,
        status=profile.status,
        credit_limit=profile.credit_limit,
        credit_used=profile.credit_used,
        credit_reserved=profile.credit_reserved,
        available_credit=profile.available_credit,
        currency=profile.currency,
        review_note=profile.review_note,
        reviewed_at=profile.reviewed_at,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("", response_model=list[AgencyAdminRead])
async def list_agencies(
    session: DatabaseSession,
    admin: CurrentAdmin,
    agency_status: Annotated[
        str | None, Query(alias="status", pattern="^(pending|approved|rejected)$")
    ] = None,
    query: Annotated[str | None, Query(max_length=120)] = None,
) -> list[AgencyAdminRead]:
    require_agency_reviewer(admin)
    profiles = await AgencyRepository(session).list_for_admin(
        status=agency_status, query=query
    )
    return [serialize_agency(profile) for profile in profiles]


@router.patch("/{profile_id}", response_model=AgencyAdminRead)
async def review_agency(
    profile_id: int,
    payload: AgencyReview,
    session: DatabaseSession,
    admin: CurrentAdmin,
    _trusted_origin: TrustedOrigin,
) -> AgencyAdminRead:
    require_agency_reviewer(admin)
    repository = AgencyRepository(session)
    profile = await repository.get_for_admin(profile_id, for_update=True)
    if profile is None:
        raise HTTPException(status_code=404, detail="agency not found")
    try:
        await repository.review(
            profile,
            status=payload.status,
            credit_limit=payload.credit_limit,
            admin_id=admin.id,
            note=payload.review_note,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    await OperationsRepository(session).create_notification(
        profile.customer_id,
        notification_type="agency",
        title=(
            "حساب آژانسی شما تأیید شد"
            if payload.status == "approved"
            else "درخواست حساب آژانسی تأیید نشد"
        ),
        body=(
            f"سقف اعتبار خرید شما {profile.credit_limit:,.0f} تومان تعیین شد."
            if payload.status == "approved"
            else (profile.review_note or "برای بررسی بیشتر با پشتیبانی تماس بگیرید.")
        ),
        link="/account/?tab=wallet",
    )
    await session.commit()
    profile = await repository.get_for_admin(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="agency not found")
    return serialize_agency(profile)
