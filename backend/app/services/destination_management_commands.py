"""Authenticated destination management and image upload endpoints."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import File, Form, HTTPException, Path, Query, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.dependencies.auth import CurrentAdmin, DatabaseSession, TrustedOrigin
from app.models import (
    Country,
    CountryImage,
    Destination,
    DestinationImage,
    MediaAsset,
    PublicationStatus,
)
from app.schemas.destination_management import (
    AdminCountry,
    AdminDestination,
    CountryUpdate,
    CountryWrite,
    DestinationUpdate,
    DestinationWrite,
    MediaAssetResponse,
)
from app.services.media import store_image


async def list_managed_countries(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminCountry]:
    rows = await session.scalars(
        select(Country)
        .options(selectinload(Country.gallery))
        .order_by(Country.display_order, Country.name)
        .limit(100)
    )
    return [AdminCountry.model_validate(row) for row in rows]


async def create_country(
    payload: CountryWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminCountry:
    values = payload.model_dump(exclude={"gallery_image_ids"})
    country = Country(
        **values,
        published_at=(
            datetime.now(UTC) if payload.status == PublicationStatus.PUBLISHED else None
        ),
    )
    country.gallery.extend(
        CountryImage(image_id=image_id, display_order=position)
        for position, image_id in enumerate(dict.fromkeys(payload.gallery_image_ids))
    )
    session.add(country)
    try:
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "country name, slug, or image is invalid") from exc
    await session.refresh(country, attribute_names=["gallery", "updated_at"])
    return AdminCountry.model_validate(country)


async def update_country(
    country_id: Annotated[int, Path(alias="countryId", ge=1)],
    payload: CountryUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminCountry:
    country = await session.scalar(
        select(Country)
        .options(selectinload(Country.gallery))
        .where(Country.id == country_id)
    )
    if country is None:
        raise HTTPException(404, "country not found")
    old_name = country.name
    for field, value in payload.model_dump(
        exclude_unset=True, exclude={"gallery_image_ids"}
    ).items():
        setattr(country, field, value)
    try:
        if payload.gallery_image_ids is not None:
            requested = list(dict.fromkeys(payload.gallery_image_ids))
            if requested != country.gallery_image_ids:
                country.gallery.clear()
                await session.flush()
                country.gallery.extend(
                    CountryImage(image_id=image_id, display_order=position)
                    for position, image_id in enumerate(requested)
                )
        if (
            payload.status == PublicationStatus.PUBLISHED
            and country.published_at is None
        ):
            country.published_at = datetime.now(UTC)
        if country.name != old_name:
            await session.execute(
                Destination.__table__.update()
                .where(Destination.country == old_name)
                .values(country=country.name)
            )
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "country name, slug, or image is invalid") from exc
    await session.refresh(country, attribute_names=["gallery", "updated_at"])
    return AdminCountry.model_validate(country)


async def delete_country(
    country_id: Annotated[int, Path(alias="countryId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    country = await session.get(Country, country_id)
    if country is None:
        raise HTTPException(404, "country not found")
    await session.execute(delete(Country).where(Country.id == country_id))
    await finish_catalog_command(session)


async def list_managed_destinations(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AdminDestination]:
    """List destinations, including drafts and archives, with bounded paging."""
    rows = await session.scalars(
        select(Destination)
        .options(selectinload(Destination.gallery))
        .order_by(Destination.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return [AdminDestination.model_validate(row) for row in rows]


async def create_destination(
    payload: DestinationWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminDestination:
    """Create a destination and apply publication timestamps."""
    country_exists = await session.scalar(
        select(Country.id).where(
            Country.name == payload.country,
            Country.status != PublicationStatus.ARCHIVED,
        )
    )
    if country_exists is None:
        raise HTTPException(422, "select a valid country")
    values = payload.model_dump(exclude={"gallery_image_ids"})
    values["published_at"] = (
        datetime.now(UTC) if payload.status == PublicationStatus.PUBLISHED else None
    )
    destination = Destination(**values)
    destination.gallery.extend(
        DestinationImage(image_id=image_id, display_order=position)
        for position, image_id in enumerate(dict.fromkeys(payload.gallery_image_ids))
    )
    session.add(destination)
    try:
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "destination slug or image is invalid") from exc
    await session.refresh(destination, attribute_names=["gallery", "updated_at"])
    return AdminDestination.model_validate(destination)


async def update_destination(
    destination_id: Annotated[int, Path(alias="destinationId", ge=1)],
    payload: DestinationUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminDestination:
    """Update content and enforce publication lifecycle timestamps."""
    destination = await session.scalar(
        select(Destination)
        .options(selectinload(Destination.gallery))
        .where(Destination.id == destination_id)
    )
    if destination is None:
        raise HTTPException(404, "destination not found")
    if payload.country is not None:
        country_exists = await session.scalar(
            select(Country.id).where(
                Country.name == payload.country,
                Country.status != PublicationStatus.ARCHIVED,
            )
        )
        if country_exists is None:
            raise HTTPException(422, "select a valid country")
    values = payload.model_dump(exclude_unset=True, exclude={"gallery_image_ids"})
    for field, value in values.items():
        setattr(destination, field, value)
    if (
        payload.status == PublicationStatus.PUBLISHED
        and destination.published_at is None
    ):
        destination.published_at = datetime.now(UTC)
    try:
        if payload.gallery_image_ids is not None:
            requested_image_ids = list(dict.fromkeys(payload.gallery_image_ids))
            if requested_image_ids != destination.gallery_image_ids:
                destination.gallery.clear()
                await session.flush()
                destination.gallery.extend(
                    DestinationImage(image_id=image_id, display_order=position)
                    for position, image_id in enumerate(requested_image_ids)
                )
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409, "destination slug, image, or relation is invalid"
        ) from exc
    await session.refresh(destination, attribute_names=["gallery", "updated_at"])
    return AdminDestination.model_validate(destination)


async def delete_destination(
    destination_id: Annotated[int, Path(alias="destinationId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    destination = await session.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(404, "destination not found")
    await session.execute(delete(Destination).where(Destination.id == destination_id))
    await finish_catalog_command(session)


async def upload_media(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
    file: Annotated[UploadFile, File()],
    alt_text: str = Form(default="", alias="altText", max_length=255),
) -> MediaAssetResponse:
    """Validate and store one bounded image upload."""
    key, mime, size, width, height = await store_image(file)
    asset = MediaAsset(
        storage_key=key,
        original_name=(file.filename or "image")[:255],
        mime_type=mime,
        byte_size=size,
        width=width,
        height=height,
        alt_text=alt_text,
    )
    session.add(asset)
    await finish_catalog_command(session)
    await session.refresh(asset)
    return MediaAssetResponse.model_validate(asset)


async def finish_catalog_command(session: DatabaseSession) -> None:
    """Let the connector commit native changes and the replay result atomically."""
    if isinstance(session.info, dict) and session.info.get("nora_atomic") is True:
        await session.flush()
    else:
        await session.commit()
