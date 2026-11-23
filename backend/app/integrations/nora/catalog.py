"""Native catalog facade. Validation and writes use the site's own commands."""

import hashlib
import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.nora.contracts import SITE_ID
from app.models import (
    Article,
    Country,
    Destination,
    ExchangeRate,
    Hotel,
    Tour,
    TravelService,
)
from app.repositories.editorial import EditorialRepository
from app.schemas import destination_management as ds
from app.schemas import editorial_management as es
from app.services import destination_management_commands as dc
from app.services import editorial_management_commands as ec

# Public native commands, never payment/booking/issuance handlers.
CATALOG = {
    "countries": (
        Country,
        ds.CountryWrite,
        ds.CountryUpdate,
        ds.AdminCountry,
        dc.create_country,
        dc.update_country,
    ),
    "destinations": (
        Destination,
        ds.DestinationWrite,
        ds.DestinationUpdate,
        ds.AdminDestination,
        dc.create_destination,
        dc.update_destination,
    ),
    "tours": (
        Tour,
        es.TourWrite,
        es.TourUpdate,
        es.AdminTour,
        ec.create_admin_tour,
        ec.update_admin_tour,
    ),
    "hotels": (
        Hotel,
        es.HotelWrite,
        es.HotelUpdate,
        es.AdminHotel,
        ec.create_admin_hotel,
        ec.update_admin_hotel,
    ),
    "service-offers": (
        TravelService,
        es.TravelServiceWrite,
        es.TravelServiceUpdate,
        es.AdminTravelService,
        ec.create_admin_service,
        ec.update_admin_service,
    ),
    "editorial-content": (
        Article,
        es.ArticleWrite,
        es.ArticleUpdate,
        es.AdminArticle,
        ec.create_article,
        ec.update_article,
    ),
}


def revision(value: datetime) -> str:
    """Lossless microsecond revision; never convert through JS numbers."""
    from datetime import UTC

    delta = value - datetime(1970, 1, 1, tzinfo=UTC)
    return str((delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds)


class CatalogRepository:
    """Bounded scalar listing and explicitly eager-loaded native record details."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(
        self,
        resource: str,
        after: int,
        limit: int = 25,
        query: str = "",
        status: str | None = None,
    ) -> dict[str, Any]:
        if resource == "exchange-rates":
            rows = list(await self.session.scalars(select(ExchangeRate).limit(50)))
            return {
                "items": [
                    {
                        "externalId": str(row.currency_code),
                        "data": {
                            "currency": row.currency_code,
                            "rate": str(row.rate_toman),
                            "quoteCurrency": "IRT",
                            "updatedAt": row.updated_at.isoformat(),
                        },
                    }
                    for row in rows
                ],
                "nextId": 0,
                "hasMore": False,
            }
        spec = CATALOG.get(resource)
        if spec is None:
            raise HTTPException(404, "resource is not supported by this site")
        model = spec[0]
        title = getattr(model, "title", None)
        if title is None:
            title = model.name
        statement = select(model.id, title, model.updated_at, model.status).where(
            model.id > after
        )
        if query:
            statement = statement.where(title.icontains(query, autoescape=True))
        if status:
            statement = statement.where(model.status == status)
        rows = list(
            (
                await self.session.execute(
                    statement.order_by(model.id).limit(limit + 1)
                )
            ).all()
        )
        return {
            "siteId": SITE_ID,
            "items": [
                {
                    "externalId": str(row.id),
                    "siteId": SITE_ID,
                    "version": revision(row.updated_at),
                    "archived": str(row.status) == "archived",
                    "data": {
                        "id": str(row.id),
                        "title": row[1],
                        "status": str(row.status),
                    },
                }
                for row in rows[:limit]
            ],
            "nextId": rows[limit - 1].id if len(rows) > limit else 0,
            "hasMore": len(rows) > limit,
        }

    async def record(self, resource: str, record_id: int, *, lock: bool = False) -> Any:
        spec = CATALOG.get(resource)
        if spec is None:
            raise HTTPException(404, "resource is not supported")
        model = spec[0]
        if lock:
            await self.session.execute(
                select(model.id).where(model.id == record_id).with_for_update()
            )
        repository = EditorialRepository(self.session)
        if resource == "tours":
            value = await repository.get_tour(record_id)
        elif resource == "hotels":
            value = await repository.get_hotel(record_id)
        else:
            options = [selectinload(model.gallery)] if hasattr(model, "gallery") else []
            value = await self.session.scalar(
                select(model)
                .options(*options)
                .where(model.id == record_id)
                .execution_options(populate_existing=True)
            )
        if value is None:
            raise HTTPException(404, "record not found")
        return value

    async def value(self, resource: str, record_id: int) -> dict[str, Any]:
        value = await self.record(resource, record_id)
        # The existing native response schema provides its eager-loaded properties.
        data = CATALOG[resource][3].model_validate(value).model_dump(mode="json")
        writable = set(CATALOG[resource][1].model_fields)
        return {
            "id": str(record_id),
            "externalId": str(record_id),
            "version": revision(value.updated_at),
            "value": {key: val for key, val in data.items() if key in writable},
        }

    async def fingerprint(self) -> str:
        snapshots = []
        for name, spec in CATALOG.items():
            count, maximum = (
                await self.session.execute(
                    select(func.count(spec[0].id), func.max(spec[0].updated_at))
                )
            ).one()
            snapshots.append((name, count, str(maximum)))
        return hashlib.sha256(json.dumps(snapshots).encode()).hexdigest()


async def save_native(
    session: AsyncSession,
    resource: str,
    admin: Any,
    payload: dict[str, Any],
    record_id: int | None,
    expected_version: str,
) -> dict[str, Any]:
    """Execute the same validated service used by the native site panel."""
    spec = CATALOG.get(resource)
    if spec is None:
        raise HTTPException(404, "resource is not writable")
    repository = CatalogRepository(session)
    if record_id is not None:
        current = await repository.record(resource, record_id, lock=True)
        if revision(current.updated_at) != expected_version:
            raise HTTPException(409, "record changed; reload before editing")
        # Native collection-only edits must also advance the parent's revision.
        current.updated_at = func.clock_timestamp()
    try:
        schema = spec[2] if record_id is not None else spec[1]
        command = schema.model_validate(payload)
        session.info["nora_atomic"] = True
        if record_id is None:
            result = await spec[4](command, session, admin, None)
        else:
            result = await spec[5](record_id, command, session, admin, None)
        return {"siteId": SITE_ID, "id": str(result.id), "saved": True}
    except ValidationError as exc:
        # Values are not reflected in errors; private payloads never escape.
        raise HTTPException(
            422, [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]
        ) from exc
    finally:
        session.info.pop("nora_atomic", None)
