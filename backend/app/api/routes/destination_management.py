"""Authenticated destination management and image upload endpoints."""

from typing import Annotated

from fastapi import APIRouter, File, Form, Path, Query, UploadFile

from app.api.dependencies.auth import CurrentAdmin, DatabaseSession, TrustedOrigin
from app.schemas.destination_management import (
    AdminCountry,
    AdminDestination,
    CountryUpdate,
    CountryWrite,
    DestinationUpdate,
    DestinationWrite,
    MediaAssetResponse,
)
from app.services import destination_management_commands as commands

router = APIRouter(prefix="/admin", tags=["destination-management"])


@router.get("/countries", response_model=list[AdminCountry])
async def list_managed_countries(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminCountry]:
    return await commands.list_managed_countries(session, _admin)


@router.post("/countries", response_model=AdminCountry, status_code=201)
async def create_country(
    payload: CountryWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminCountry:
    return await commands.create_country(payload, session, _admin, _origin)


@router.patch("/countries/{countryId}", response_model=AdminCountry)
async def update_country(
    country_id: Annotated[int, Path(alias="countryId", ge=1)],
    payload: CountryUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminCountry:
    return await commands.update_country(country_id, payload, session, _admin, _origin)


@router.delete("/countries/{countryId}", status_code=204)
async def delete_country(
    country_id: Annotated[int, Path(alias="countryId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_country(country_id, session, _admin, _origin)


@router.get("/destinations", response_model=list[AdminDestination])
async def list_managed_destinations(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AdminDestination]:
    return await commands.list_managed_destinations(session, _admin, offset, limit)


@router.post("/destinations", response_model=AdminDestination, status_code=201)
async def create_destination(
    payload: DestinationWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminDestination:
    return await commands.create_destination(payload, session, _admin, _origin)


@router.patch("/destinations/{destinationId}", response_model=AdminDestination)
async def update_destination(
    destination_id: Annotated[int, Path(alias="destinationId", ge=1)],
    payload: DestinationUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminDestination:
    return await commands.update_destination(
        destination_id, payload, session, _admin, _origin
    )


@router.delete("/destinations/{destinationId}", status_code=204)
async def delete_destination(
    destination_id: Annotated[int, Path(alias="destinationId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_destination(destination_id, session, _admin, _origin)


@router.post("/media", response_model=MediaAssetResponse, status_code=201)
async def upload_media(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
    file: Annotated[UploadFile, File()],
    alt_text: str = Form(default="", alias="altText", max_length=255),
) -> MediaAssetResponse:
    return await commands.upload_media(session, _admin, _origin, file, alt_text)
