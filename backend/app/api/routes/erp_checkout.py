"""Authenticated customer endpoints for draft-only Avina checkout."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Response

from app.api.dependencies.auth import CurrentCustomer, DatabaseSession, TrustedOrigin
from app.integrations.avina import AvinaError, avina_client
from app.repositories import rubi_catalog
from app.repositories.erp_checkout import ErpCheckoutRepository
from app.schemas.erp_checkout import (
    ErpFlightCapacityCheck,
    ErpFlightCheckoutCreate,
    ErpFlightCheckoutRead,
    ErpFlightQuoteReview,
    ErpFlightSettlement,
)
from app.services.erp_flight_checkout import ErpFlightCheckoutService

router = APIRouter(prefix="/account/erp-flight-checkouts", tags=["erp-checkout"])


@router.get("")
async def list_erp_flight_checkouts(
    session: DatabaseSession,
    customer: CurrentCustomer,
    response: Response,
) -> list[ErpFlightCheckoutRead]:
    response.headers["Cache-Control"] = "private, no-store"
    return await ErpFlightCheckoutService(session).recent(customer.id)


@router.post("/capacity", status_code=204)
async def check_erp_flight_capacity(
    payload: ErpFlightCapacityCheck,
    _customer: CurrentCustomer,
    _trusted: TrustedOrigin,
) -> Response:
    """Ask Avina for both legs before checkout writes any traveler profiles."""
    try:
        await avina_client.quote(
            payload.product_ids, [birth.isoformat() for birth in payload.birth_dates]
        )
    except AvinaError as error:
        if error.status in {400, 403, 404, 409, 422}:
            raise HTTPException(
                409,
                "ظرفیت یا امکان فروش برای تعداد مسافران انتخاب‌شده تأیید نشد.",
            ) from error
        raise HTTPException(
            503, "استعلام ظرفیت پرواز از آوینا انجام نشد. دوباره تلاش کنید."
        ) from error
    return Response(status_code=204, headers={"Cache-Control": "private, no-store"})


@router.post("/review")
async def review_erp_flight_checkout(
    payload: ErpFlightCheckoutCreate,
    session: DatabaseSession,
    customer: CurrentCustomer,
    _trusted: TrustedOrigin,
) -> ErpFlightQuoteReview:
    flights = await rubi_catalog.all_flights(session)
    flight = next(
        (item for item in flights if item.product_ids == payload.product_ids), None
    )
    if flight is None:
        raise HTTPException(
            409, "ظ¾ط±ظˆط§ط² ط§ظ†طھط®ط§ط¨â€Œط´ط¯ظ‡ ط¯غŒع¯ط± ط¯ط± ط¯ط³طھط±ط³ ظ†غŒط³طھ."
        )
    return await ErpFlightCheckoutService(session).review(
        customer.id, flight, payload.passenger_ids
    )


@router.post("", response_model=ErpFlightCheckoutRead, response_model_by_alias=True)
async def create_erp_flight_checkout(
    payload: ErpFlightCheckoutCreate,
    session: DatabaseSession,
    customer: CurrentCustomer,
    _trusted: TrustedOrigin,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
) -> ErpFlightCheckoutRead:
    try:
        key = UUID(idempotency_key)
    except ValueError as error:
        raise HTTPException(422, "Idempotency-Key must be a UUID") from error
    flights = await rubi_catalog.all_flights(session)
    flight = next(
        (item for item in flights if item.product_ids == payload.product_ids), None
    )
    return await ErpFlightCheckoutService(session).create_or_resume(
        key=key,
        customer=customer,
        flight=flight,
        product_ids=payload.product_ids,
        passenger_ids=payload.passenger_ids,
        quote_version=payload.quote_version,
        require_review=True,
    )


@router.get(
    "/{checkout_id}", response_model=ErpFlightCheckoutRead, response_model_by_alias=True
)
async def read_erp_flight_checkout(
    checkout_id: UUID, session: DatabaseSession, customer: CurrentCustomer
) -> ErpFlightCheckoutRead:
    return await ErpFlightCheckoutService(session).read(checkout_id, customer.id)


@router.get("/{checkout_id}/settlement")
async def read_erp_flight_settlement(
    checkout_id: UUID,
    session: DatabaseSession,
    customer: CurrentCustomer,
    response: Response,
) -> ErpFlightSettlement:
    response.headers["Cache-Control"] = "private, no-store"
    return await ErpFlightCheckoutService(session).settlement(checkout_id, customer.id)


@router.get("/{checkout_id}/details")
async def read_checkout_details(
    checkout_id: UUID,
    session: DatabaseSession,
    customer: CurrentCustomer,
    response: Response,
) -> dict:
    row = await ErpCheckoutRepository(session).owned(checkout_id, customer.id)
    if row is None:
        raise HTTPException(404, "checkout not found")
    response.headers["Cache-Control"] = "private, no-store"
    snapshot = row.request_payload
    flight = snapshot.get("flight") or {}
    legs = [leg for leg in (flight, flight.get("return_leg")) if leg]
    missing_logo_ids = {
        leg["product_id"]
        for leg in legs
        if leg.get("product_id") and not leg.get("carrier_logo_sha256")
    }
    current_logos = {}
    if missing_logo_ids:
        for flight_record in await rubi_catalog.all_flights(session):
            for leg in (flight_record, flight_record.return_leg):
                if (
                    leg
                    and leg.product_id in missing_logo_ids
                    and leg.carrier_logo_sha256
                ):
                    current_logos[leg.product_id] = leg.carrier_logo_sha256

    return {
        "legs": [
            {
                **{
                    key: leg.get(key)
                    for key in (
                        "origin",
                        "destination",
                        "carrier",
                        "departure",
                        "arrival",
                        "service_number",
                        "cabin_class_code",
                        "origin_airport",
                        "destination_airport",
                        "baggage_kg",
                    )
                },
                "carrier_logo_sha256": leg.get("carrier_logo_sha256")
                or current_logos.get(leg.get("product_id")),
            }
            for leg in legs
        ],
        "totals": [
            {"amount": line["amount"], "currency": line["currencyCode"]}
            for line in (row.erp_payload or {}).get("priceComponents", [])
        ],
        "passengers": [
            {
                key: person.get(key)
                for key in (
                    "firstName",
                    "lastName",
                    "firstNameEn",
                    "lastNameEn",
                    "birthDate",
                )
            }
            for person in snapshot.get("passengers", [])
        ],
    }
