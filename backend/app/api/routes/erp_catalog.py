"""Rubi catalog ingress and public flight rate projection."""

import os
import time
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request, Response
from pydantic import ValidationError

from app.api.dependencies.auth import DatabaseSession
from app.repositories import rubi_catalog
from app.services.rubi_catalog import (
    Catalog,
    PublicDatedTour,
    PublicFlight,
    Receipt,
    filter_public_flights,
    valid_signature,
)

router = APIRouter(prefix="/erp", tags=["rubi-catalog"])


@router.get("/airline-logos/{sha256}")
async def airline_logo(
    session: DatabaseSession,
    sha256: Annotated[str, Path(pattern=r"^[0-9a-f]{64}$")],
) -> Response:
    image = await rubi_catalog.airline_logo(session, sha256)
    if image is None:
        raise HTTPException(404, "Airline logo not found")
    return Response(
        image,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/catalog-delivery")
async def receive_catalog(request: Request, session: DatabaseSession) -> Receipt:
    key = os.getenv("JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET", "")
    if len(key) < 32:
        raise HTTPException(503, "Catalog receiver is not configured")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > 4 * 1024 * 1024:
            raise HTTPException(413, "Catalog too large")
        body.extend(chunk)
    if not valid_signature(
        bytes(body),
        request.headers.get("x-erp-timestamp", ""),
        request.headers.get("x-erp-signature", ""),
        key,
        int(time.time()),
    ):
        raise HTTPException(401, "Invalid catalog signature")
    try:
        value = Catalog.model_validate_json(body)
    except ValidationError as error:
        raise HTTPException(422, "Invalid site catalog") from error
    if not await rubi_catalog.accept(session, value):
        raise HTTPException(409, "Superseded catalog revision")
    return Receipt(accepted=True, revision=value.revision)


@router.get("/flight-rates")
async def flight_rates(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    origin: str | None = None,
    destination: str | None = None,
    departure_date: Annotated[date | None, Query(alias="departureDate")] = None,
    return_date: Annotated[date | None, Query(alias="returnDate")] = None,
    trip_type: Annotated[
        Literal["one_way", "round_trip"] | None, Query(alias="tripType")
    ] = None,
) -> list[PublicFlight]:
    items = filter_public_flights(
        await rubi_catalog.all_flights(session),
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        return_date=return_date if trip_type == "round_trip" else None,
        trip_type=trip_type,
    )
    return items[offset : offset + limit]


@router.get("/dated-tours")
async def dated_tours(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> list[PublicDatedTour]:
    return await rubi_catalog.dated_tours(session, offset, limit)
