"""Idempotent draft-only Avina ERP flight checkout orchestration."""

import asyncio
import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.avina import AvinaClient, AvinaError, avina_client
from app.models import CustomerUser, ErpFlightCheckout
from app.repositories.erp_checkout import ErpCheckoutRepository
from app.schemas.erp_checkout import (
    ErpFlightCheckoutRead,
    ErpFlightQuoteLine,
    ErpFlightQuoteReview,
    ErpFlightSettlement,
)
from app.services.rubi_catalog import PublicFlight

TEHRAN = timezone(timedelta(hours=3, minutes=30))


def _fingerprint(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _person_payload(
    *,
    first_name: str,
    last_name: str,
    birth_date: str | None,
    national_id: str | None = None,
    passport_number: str | None = None,
    passport_expiry: str | None = None,
    passport_first: str | None = None,
    passport_last: str | None = None,
    gender: str | None = None,
    role: str,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "kind": "person",
        "firstName": first_name,
        "lastName": last_name,
        "displayName": f"{first_name} {last_name}".strip(),
        "roles": [role],
    }
    optional = {
        "birthDate": birth_date,
        "nationalId": national_id,
        "passportNumber": passport_number,
        "passportExpiryDate": passport_expiry,
        "passportFirstName": passport_first,
        "passportLastName": passport_last,
        "gender": {"male": "M", "female": "F"}.get(gender or ""),
    }
    value.update({key: item for key, item in optional.items() if item})
    return value


def _age_category(birth: date, departure: date) -> str:
    years = (
        departure.year
        - birth.year
        - ((departure.month, departure.day) < (birth.month, birth.day))
    )
    return "ADT" if years >= 12 else "CHD" if years >= 2 else "INF"


def _quote_review(
    product_ids: list[str],
    passenger_ids: list[int],
    dates: list[str],
    quote: list[dict[str, Any]],
) -> ErpFlightQuoteReview:
    totals: dict[str, Decimal] = {}
    fares: list[ErpFlightQuoteLine] = []
    prices = []
    for index, price in enumerate(quote):
        currency, amount = price["currencyCode"], Decimal(str(price["amount"]))
        totals[currency] = totals.get(currency, Decimal(0)) + amount
        prices.append([currency, format(amount.normalize(), "f")])
        details = price.get("pricingBreakdown")
        if not isinstance(details, dict):
            continue
        coverage = details.get("coverage")
        rows = details.get("passengers")
        if coverage not in {"one_way", "round_trip"} or not isinstance(rows, list):
            continue
        for row in rows:
            if (
                isinstance(row, dict)
                and row.get("category") in {"ADT", "CHD", "INF"}
                and isinstance(row.get("amount"), str)
            ):
                fares.append(
                    ErpFlightQuoteLine(
                        currency_code=currency,
                        amount=str(row["amount"]),
                        category=row["category"],
                        coverage=coverage,
                        leg=None if coverage == "round_trip" else index + 1,
                    )
                )
    return ErpFlightQuoteReview(
        quote_version=_fingerprint(
            [
                product_ids,
                passenger_ids,
                dates,
                prices,
                [line.model_dump(mode="json") for line in fares],
            ]
        ),
        totals=[
            ErpFlightQuoteLine(currency_code=currency, amount=format(amount, "f"))
            for currency, amount in sorted(totals.items())
        ],
        fares=fares,
    )


class ErpFlightCheckoutService:
    def __init__(self, session: AsyncSession, erp: AvinaClient = avina_client) -> None:
        self.erp = erp
        self.repository = ErpCheckoutRepository(session)

    async def create_or_resume(
        self,
        *,
        key: UUID,
        customer: CustomerUser,
        product_ids: list[str],
        passenger_ids: list[int],
        flight: PublicFlight | None,
        quote_version: str | None = None,
        require_review: bool = False,
    ) -> ErpFlightCheckoutRead:
        customer_id = customer.id
        customer_data = {
            "fullName": customer.full_name,
            "birthDate": customer.birth_date.isoformat()
            if customer.birth_date
            else None,
            "nationalCode": customer.national_code,
        }
        if len(set(passenger_ids)) != len(passenger_ids):
            raise HTTPException(422, "passenger IDs must be unique")
        identity = {
            "version": 1,
            "productIds": product_ids,
            "passengerIds": passenger_ids,
        }
        fingerprint = _fingerprint(identity)
        existing = await self.repository.get(key)
        if existing is not None:
            return await self._resume(existing, customer_id, customer_data, fingerprint)
        if require_review and not quote_version:
            raise HTTPException(409, "ابتدا مبلغ و اطلاعات مسافران را بررسی کنید.")
        if flight is None or flight.product_ids != product_ids:
            raise HTTPException(409, "selected ERP flight is no longer available")

        passengers = await self.repository.passengers(customer_id, passenger_ids)
        by_id = {row.id: row for row in passengers}
        if len(by_id) != len(passenger_ids):
            raise HTTPException(404, "passenger not found")
        ordered = [by_id[item] for item in passenger_ids]
        if any(row.birth_date is None for row in ordered):
            raise HTTPException(422, "passenger birth date is required")
        request_payload = {
            "version": 1,
            "productIds": product_ids,
            "quoteVersion": quote_version,
            "flight": flight.model_dump(mode="json"),
            "passengers": [
                {
                    "id": row.id,
                    "firstName": row.first_name,
                    "lastName": row.last_name,
                    "firstNameEn": row.first_name_en,
                    "lastNameEn": row.last_name_en,
                    "nationalCode": row.national_code,
                    "passportNumber": row.passport_number,
                    "passportExpiryDate": row.passport_expiry_date.isoformat()
                    if row.passport_expiry_date
                    else None,
                    "gender": row.gender,
                    "birthDate": row.birth_date.isoformat() if row.birth_date else None,
                }
                for row in ordered
            ],
        }
        row = await self.repository.insert(
            ErpFlightCheckout(
                id=key,
                customer_id=customer_id,
                external_id=f"jahan-{key.hex}",
                request_fingerprint=fingerprint,
                request_payload=request_payload,
            )
        )
        return await self._resume(row, customer_id, customer_data, fingerprint)

    async def review(
        self, customer_id: int, flight: PublicFlight, passenger_ids: list[int]
    ) -> ErpFlightQuoteReview:
        if len(set(passenger_ids)) != len(passenger_ids):
            raise HTTPException(422, "مسافر تکراری است.")
        rows = await self.repository.passengers(customer_id, passenger_ids)
        owned = {row.id: row for row in rows}
        dates = []
        identities = []
        departure = flight.departure.astimezone(TEHRAN).date()
        for index, passenger_id in enumerate(passenger_ids, start=1):
            row = owned.get(passenger_id)
            if row is None:
                raise HTTPException(404, f"مسافر {index} پیدا نشد.")
            if row.birth_date is None or row.birth_date > departure:
                raise HTTPException(422, f"تاریخ تولد مسافر {index} معتبر نیست.")
            if row.passport_expiry_date and row.passport_expiry_date < departure:
                raise HTTPException(
                    422, f"گذرنامهٔ مسافر {index} در تاریخ پرواز معتبر نیست."
                )
            dates.append(row.birth_date.isoformat())
            identities.append(
                _person_payload(
                    first_name=row.first_name or "مسافر",
                    last_name=row.last_name or "جهان باستان",
                    birth_date=dates[-1],
                    national_id=row.national_code,
                    passport_number=row.passport_number,
                    passport_expiry=row.passport_expiry_date.isoformat()
                    if row.passport_expiry_date
                    else None,
                    passport_first=row.first_name_en,
                    passport_last=row.last_name_en,
                    gender=row.gender,
                    role="passenger",
                )
            )
        try:
            identities_result = await self.erp.check_people(identities)
            if identities_result is not None:
                invalid = [
                    str(row["index"] + 1)
                    for row in identities_result
                    if not row["valid"]
                ]
                if invalid:
                    raise HTTPException(
                        422,
                        "مشخصات هویتی این مسافران در آوینا نیاز به بررسی دارد: "
                        + ", ".join(invalid),
                    )
            quote = await self.erp.quote(flight.product_ids, dates)
        except AvinaError as error:
            raise HTTPException(503 if error.retryable else 409, str(error)) from error
        result = _quote_review(flight.product_ids, passenger_ids, dates, quote)
        result.identity_checked = identities_result is not None
        return result

    async def _resume(
        self,
        row: ErpFlightCheckout,
        customer_id: int,
        customer_data: dict[str, Any],
        fingerprint: str,
    ) -> ErpFlightCheckoutRead:
        if row.customer_id != customer_id:
            raise HTTPException(404, "checkout not found")
        if row.request_fingerprint != fingerprint:
            raise HTTPException(
                409, "idempotency key was used with different checkout data"
            )
        return await self._drive(row.id, customer_id, customer_data)

    async def read(self, checkout_id: UUID, customer_id: int) -> ErpFlightCheckoutRead:
        row = await self.repository.owned(checkout_id, customer_id)
        if row is None:
            raise HTTPException(404, "checkout not found")
        cancelled = await self.repository.cancelled([row])
        return self._read(row, row.external_id in cancelled)

    async def recent(self, customer_id: int) -> list[ErpFlightCheckoutRead]:
        rows = await self.repository.recent(customer_id)
        cancelled = await self.repository.cancelled(rows)
        return [self._read(row, row.external_id in cancelled) for row in rows]

    async def settlement(
        self, checkout_id: UUID, customer_id: int
    ) -> ErpFlightSettlement:
        row = await self.repository.owned(checkout_id, customer_id)
        if row is None or not row.erp_contract_id:
            raise HTTPException(404, "قرارداد پیدا نشد.")
        try:
            result = await self.erp.status(row.external_id)
        except AvinaError as error:
            raise HTTPException(503, "وضعیت مالی آوینا در دسترس نیست.") from error
        status = result.get("data")
        if (
            not isinstance(status, dict)
            or status.get("contractId") != row.erp_contract_id
        ):
            raise HTTPException(502, "پاسخ قرارداد آوینا معتبر نیست.")
        if status.get("status") == "CANCELLED":
            return ErpFlightSettlement(state="cancelled")
        if (
            status.get("hasConfirmedPayment") is True
            and status.get("fullySettled") is True
        ):
            return ErpFlightSettlement(state="settled")
        return ErpFlightSettlement(state="unpaid")

    async def _drive(
        self, checkout_id: UUID, customer_id: int, customer_data: dict[str, Any]
    ) -> ErpFlightCheckoutRead:
        for _ in range(60):
            row = await self.repository.get(checkout_id)
            if row is None:
                raise HTTPException(404, "checkout not found")
            if row.state == "draft":
                return await self.read(row.id, customer_id)
            if row.state == "failed" and not row.error_retryable:
                return self._read(row)
            if row.erp_payload is None:
                token = await self.repository.claim(
                    row.id, "preparing", {"received", "failed", "preparing"}
                )
                if token:
                    try:
                        payload = await self._prepare(
                            row.request_payload, row.external_id, customer_data
                        )
                    except AvinaError as error:
                        await self.repository.fail(
                            row.id,
                            token,
                            code=error.code,
                            message=str(error),
                            uncertain=False,
                            retryable=error.retryable,
                        )
                        return await self.read(row.id, customer_id)
                    await self.repository.store_payload(row.id, token, payload)
                    continue
            else:
                previous_state = row.state
                token = await self.repository.claim(
                    row.id,
                    "dispatching",
                    {"prepared", "uncertain", "failed", "dispatching"},
                )
                if token:
                    try:
                        result: dict[str, Any] | None = None
                        if previous_state == "uncertain":
                            try:
                                result = await self.erp.status(row.external_id)
                            except AvinaError as error:
                                if error.status != 404:
                                    raise
                        if result is None:
                            result = await self.erp.draft(
                                row.external_id, row.erp_payload
                            )
                    except AvinaError as error:
                        await self.repository.fail(
                            row.id,
                            token,
                            code=error.code,
                            message=str(error),
                            uncertain=error.retryable,
                            retryable=error.retryable,
                        )
                        return await self.read(row.id, customer_id)
                    await self.repository.complete(row.id, token, result)
                    continue
            await asyncio.sleep(0.05)
        row = await self.repository.get(checkout_id)
        if row is None:
            raise HTTPException(404, "checkout not found")
        return self._read(row)

    async def _prepare(
        self,
        request: dict[str, Any],
        external_id: str,
        customer: dict[str, Any],
    ) -> dict[str, Any]:
        sources = request["passengers"]
        dates = [item["birthDate"] for item in sources]
        quote = await self.erp.quote(request["productIds"], dates)
        if request.get("quoteVersion"):
            review = _quote_review(
                request["productIds"], [item["id"] for item in sources], dates, quote
            )
            if review.quote_version != request["quoteVersion"]:
                raise AvinaError(
                    "quote_changed",
                    "نرخ پرواز تغییر کرده است. دوباره مبلغ را بررسی کنید.",
                    retryable=False,
                    status=409,
                )
        names = customer["fullName"].split(maxsplit=1)
        buyer = await self.erp.buyer(
            f"{external_id}-buyer",
            _person_payload(
                first_name=names[0],
                last_name=names[1] if len(names) > 1 else "مسافر",
                birth_date=customer["birthDate"],
                national_id=customer["nationalCode"],
                role="customer",
            ),
        )
        people = []
        for item in sources:
            result = await self.erp.person(
                _person_payload(
                    first_name=item["firstName"] or "مسافر",
                    last_name=item["lastName"] or "جهان باستان",
                    birth_date=item["birthDate"],
                    national_id=item["nationalCode"],
                    passport_number=item["passportNumber"],
                    passport_expiry=item["passportExpiryDate"],
                    passport_first=item["firstNameEn"],
                    passport_last=item["lastNameEn"],
                    gender=item["gender"],
                    role="passenger",
                )
            )
            people.append(result.get("data") or {})
        buyer_data = buyer.get("data") or {}
        if not buyer_data.get("id") or any(not person.get("id") for person in people):
            raise AvinaError(
                "erp_invalid_customer", "شناسه مسافر ERP معتبر نبود.", retryable=True
            )
        return self._order_payload(request, quote, buyer_data, people)

    def _order_payload(
        self,
        request: dict[str, Any],
        quote: list[dict[str, Any]],
        buyer: dict[str, Any],
        people: list[dict[str, Any]],
    ) -> dict[str, Any]:
        flight = request["flight"]
        legs = [flight] + ([flight["return_leg"]] if flight.get("return_leg") else [])
        services, tickets, keys = [], [], []
        totals: dict[str, Decimal] = {}
        for index, (leg, price) in enumerate(zip(legs, quote, strict=True)):
            direction = "OUTBOUND" if index == 0 else "RETURN"
            key = "flight-outbound" if index == 0 else "flight-return"
            keys.append(key)
            amount, currency = str(price["amount"]), str(price["currencyCode"])
            totals[currency] = totals.get(currency, Decimal(0)) + Decimal(amount)
            services.append(
                {
                    "kind": "FLIGHT",
                    "clientKey": key,
                    "titleSnapshot": (
                        f"{leg['carrier']} {leg.get('service_number') or ''}".strip()
                    ),
                    "referenceId": leg["offer_id"],
                    "metadata": {
                        "direction": direction,
                        "catalogSaleQuoteVersion": 1,
                        "catalogSaleQuoteAmount": amount,
                        "catalogSaleQuoteCurrency": currency,
                    },
                }
            )
            tickets.append(
                {
                    "offerId": leg["offer_id"],
                    "direction": direction,
                    "originId": leg["origin_id"],
                    "destinationId": leg["destination_id"],
                    "departureAt": leg["departure"],
                    "arrivalAt": leg["arrival"],
                    "carrierNameSnapshot": leg["carrier"],
                    "serviceNumberSnapshot": leg.get("service_number") or "",
                    "cabinClassCode": leg.get("cabin_class_code") or "ECONOMY",
                    "serviceClientKey": key,
                    "quotedPrice": {"amount": amount, "currencyCode": currency},
                }
            )
        departure = datetime.fromisoformat(flight["departure"]).date()
        passengers = [
            {
                "customerId": person["id"],
                "displayNameSnapshot": person.get("displayName")
                or f"{source['firstName']} {source['lastName']}",
                "birthDate": source["birthDate"],
                "ageCategory": _age_category(
                    date.fromisoformat(source["birthDate"]), departure
                ),
                "serviceClientKeys": keys,
            }
            for source, person in zip(request["passengers"], people, strict=True)
        ]
        payload: dict[str, Any] = {
            "customerId": buyer["id"],
            "originId": flight["origin_id"],
            "destinationId": flight["destination_id"],
            "departureDate": departure.isoformat(),
            "tripType": "ROUND_TRIP" if len(legs) == 2 else "ONE_WAY",
            "services": services,
            "passengers": passengers,
            "ticketSelections": tickets,
            "priceComponents": [
                {
                    "type": "BASE",
                    "title": "Avina ERP",
                    "amount": format(amount, "f"),
                    "currencyCode": currency,
                }
                for currency, amount in sorted(totals.items())
            ],
        }
        if len(legs) == 2:
            payload["returnNotBefore"] = (
                datetime.fromisoformat(legs[1]["departure"]).date().isoformat()
            )
        return payload

    def _read(
        self,
        row: ErpFlightCheckout,
        cancelled: bool = False,
    ) -> ErpFlightCheckoutRead:
        flight = row.request_payload.get("flight") or {}
        route = " به ".join(
            part for part in (flight.get("origin"), flight.get("destination")) if part
        )
        return ErpFlightCheckoutRead(
            id=row.id,
            state="cancelled" if cancelled else row.state,
            contract_number=row.erp_contract_number,
            erp_status="CANCELLED" if cancelled else row.erp_status,
            route_label=route or None,
            retryable=not cancelled
            and (
                row.state in {"received", "prepared", "uncertain"}
                or (row.state == "failed" and row.error_retryable)
            ),
            message="این قرارداد در آوینا لغو شده است."
            if cancelled
            else row.error_message,
            error_code=None if cancelled else row.error_code,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
