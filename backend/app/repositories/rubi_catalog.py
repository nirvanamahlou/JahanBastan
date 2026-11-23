"""Atomic, monotonically versioned site-local catalog storage."""

from datetime import UTC, datetime

from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Destination, Hotel
from app.services.rubi_catalog import (
    Catalog,
    PublicDatedTour,
    PublicFlight,
    catalog_logo_png,
    public_flights,
)


async def accept(session: AsyncSession, value: Catalog) -> bool:
    inserted = await session.scalar(
        text("""
        INSERT INTO rubi_catalog_receipt (site, revision, snapshot)
        VALUES (:site, :revision, CAST(:snapshot AS jsonb))
        ON CONFLICT (site) DO UPDATE SET
            revision = EXCLUDED.revision, snapshot = EXCLUDED.snapshot,
            received_at = now()
        WHERE rubi_catalog_receipt.revision < EXCLUDED.revision
        RETURNING revision
    """),
        {
            "site": value.site,
            "revision": value.revision,
            "snapshot": value.model_dump_json(),
        },
    )
    if inserted is None:
        inserted = await session.scalar(
            text("SELECT revision FROM rubi_catalog_receipt WHERE site = :site"),
            {"site": value.site},
        )
    await session.commit()
    return inserted == value.revision


async def flights(session: AsyncSession, offset: int, limit: int) -> list[PublicFlight]:
    return (await all_flights(session))[offset : offset + limit]


async def all_flights(session: AsyncSession) -> list[PublicFlight]:
    row = (
        await session.execute(
            text("""
                SELECT snapshot->'data',
                       jsonb_path_query_array(snapshot, '$.airlineLogos[*].sha256')
                FROM rubi_catalog_receipt WHERE site = 'jahan-bastan'
            """)
        )
    ).one_or_none()
    if row is None:
        return []
    items, hashes = row
    return public_flights(
        items or [],
        datetime.now(UTC),
        frozenset(value for value in hashes if isinstance(value, str)),
    )


async def airline_logo(session: AsyncSession, sha256: str) -> bytes | None:
    asset = await session.scalar(
        text("""
            SELECT logo
            FROM rubi_catalog_receipt,
                 jsonb_array_elements(
                     CASE WHEN jsonb_typeof(snapshot->'airlineLogos') = 'array'
                          THEN snapshot->'airlineLogos' ELSE '[]'::jsonb END
                 ) AS assets(logo)
            WHERE site = 'jahan-bastan' AND logo->>'sha256' = :hash
            LIMIT 1
        """),
        {"hash": sha256},
    )
    return catalog_logo_png(asset, sha256) if isinstance(asset, dict) else None


async def dated_tours(
    session: AsyncSession, offset: int, limit: int
) -> list[PublicDatedTour]:
    rows = await session.execute(
        text("""
        SELECT item, choice, editorial.title, editorial.summary, editorial.description
        FROM rubi_catalog_receipt,
        LATERAL jsonb_array_elements(snapshot->'data') AS products(item)
        LEFT JOIN LATERAL jsonb_array_elements(
            CASE WHEN item->>'kind' = 'floating-tour'
                  AND jsonb_typeof(item->'floatingRooms') = 'array'
                 THEN item->'floatingRooms' ELSE '[]'::jsonb END
        ) AS rooms(choice) ON true
        LEFT JOIN avina_tour_editorial AS editorial
          ON editorial.kind = item->>'kind'
          AND editorial.resource_id = item->>'resourceId'
        WHERE site = 'jahan-bastan' AND item->'enabled' = 'true'::jsonb
          AND NOT coalesce(editorial.hidden, false)
          AND (
            (item->>'kind' = 'tour' AND item->'tour'->>'endsOn' >=
                to_char(now() at time zone 'Asia/Tehran', 'YYYY-MM-DD'))
            OR (item->>'kind' = 'floating-tour'
                AND choice->>'checkIn' >=
                    to_char(now() at time zone 'Asia/Tehran', 'YYYY-MM-DD')
                AND choice->>'roomCode' ~ '^[a-f0-9]{64}$')
          )
        ORDER BY coalesce(choice->>'checkIn', item->'tour'->>'startsOn'),
                 item->>'id', choice->>'roomCode'
        LIMIT :limit OFFSET :offset
    """),
        {"limit": limit, "offset": offset},
    )
    result = []
    for row, choice, title, summary, description in rows:
        projected = (
            floating_departure(row, choice)
            if choice is not None
            else project_dated(row)
        )
        if title:
            projected.title = title
        if summary:
            projected.details.summary = summary
        if description:
            projected.description = description
            projected.details.description = description
        result.append(projected)
    await attach_hotel_profiles(session, result)
    return result


def project_dated(row: dict) -> PublicDatedTour:
    tour = row["tour"]
    package = tour["package"]
    presentation = row.get("presentation") or {}
    return PublicDatedTour.model_validate(
        {
            **tour,
            "id": row["resourceId"],
            "resourceId": row["resourceId"],
            "details": package.get("details") or {},
            "includedServices": [
                label
                for field, label in (
                    ("transferOutbound", "ترانسفر رفت"),
                    ("transferReturn", "ترانسفر برگشت"),
                    ("visa", "ویزا"),
                    ("cityTour", "گشت شهری"),
                    ("tourGuide", "راهنمای تور"),
                    ("insuranceId", "بیمهٔ سفر"),
                )
                if package.get(field)
            ],
            "title": presentation.get("title") or tour.get("name") or package["name"],
            "description": presentation.get("description")
            or (package.get("details") or {}).get("description"),
            "hotels": row.get("hotels", []),
            "rates": row.get("passengerRates", []),
            "previewOnly": row.get("previewOnly", False),
            "salesStopped": row["salesStopped"],
        }
    )


async def attach_hotel_profiles(
    session: AsyncSession, tours: list[PublicDatedTour]
) -> None:
    hotels = [hotel for tour in tours for hotel in tour.hotels]
    if not hotels:
        return
    codes = {hotel.identificationCode for hotel in hotels if hotel.identificationCode}
    cities = {hotel.city.name for hotel in hotels if hotel.city}
    profiles = (
        await session.execute(
            select(
                Hotel.slug,
                Hotel.hotel_code,
                Hotel.avina_identification_code,
                Hotel.name,
                Hotel.avina_profile,
                Destination.city,
                Destination.title,
                Destination.country,
            )
            .join(Destination, Hotel.destination_id == Destination.id)
            .where(
                Hotel.status == "published",
                Destination.status == "published",
                or_(
                    Hotel.hotel_code.in_(codes),
                    Hotel.avina_identification_code.in_(codes),
                    Destination.city.in_(cities),
                    Destination.title.in_(cities),
                ),
            )
        )
    ).all()

    def normalized(value: str | None) -> str:
        return "".join(c for c in (value or "").casefold() if c.isalnum())

    for hotel in hotels:
        names = {normalized(n) for n in (hotel.name, hotel.englishName) if n}
        matches = {
            p.slug
            for p in profiles
            if (
                hotel.identificationCode in (p.hotel_code, p.avina_identification_code)
                if hotel.identificationCode
                else hotel.city
                and hotel.city.name in (p.city, p.title)
                and hotel.city.country.name == p.country
                and names.intersection(
                    {
                        normalized(p.name),
                        normalized((p.avina_profile or {}).get("englishName")),
                        normalized(p.slug),
                    }
                )
            )
        }
        hotel.profileSlug = matches.pop() if len(matches) == 1 else None


def floating_departure(row: dict, choice: dict) -> PublicDatedTour:
    package = row["floatingTour"]["package"]
    presentation = row.get("presentation") or {}
    details = package.get("details") or {}
    stays = choice["stays"]
    hotel_ids = {stay["hotelId"] for stay in stays}
    schedule = choice["flightSchedule"]

    def flight(leg: dict) -> dict:
        return {
            **leg,
            "originName": leg["originAirport"]["name"],
            "destinationName": leg["destinationAirport"]["name"],
        }

    groups = {
        "double": "double",
        "single": "single",
        "extra": "extra",
        "childBed": "childWithBed",
        "childNoBed": "childWithoutBed",
        "infant": "infant",
    }
    rates = [
        {
            "hotelId": choice["hotelId"],
            "roomTypeName": choice["roomTypeName"],
            "kind": kind,
            "checkIn": choice["checkIn"],
            "checkOut": choice["checkOut"],
            "hotel": [],
            "flight": [],
            "total": [{"amount": amount, "currencyCode": "IRR"}],
        }
        for source, kind in groups.items()
        if (amount := choice["ratesIrr"].get(source)) is not None
    ]
    return PublicDatedTour.model_validate(
        {
            "id": f"{row['id']}-{choice['roomCode']}",
            "kind": "floating-tour",
            "resourceId": row.get("resourceId", row["id"]),
            "title": presentation.get("title") or package["name"],
            "description": presentation.get("description")
            or details.get("description"),
            "details": details,
            "startsOn": choice["checkIn"],
            "endsOn": choice["checkOut"],
            "remainingCapacity": None,
            "outbound": flight(schedule["outbound"]),
            "returning": flight(schedule["inbound"]),
            "hotels": [
                hotel for hotel in row.get("hotels", []) if hotel["id"] in hotel_ids
            ],
            "rates": rates,
            "previewOnly": row.get("previewOnly", False),
            "salesStopped": row["salesStopped"],
        }
    )


async def editorial_tours(session: AsyncSession) -> list[dict]:
    rows = await session.execute(
        text("""
        SELECT DISTINCT ON (item->>'kind', item->>'resourceId')
            item->>'kind' AS kind, item->>'resourceId' AS "resourceId",
            coalesce(nullif(btrim(item->'presentation'->>'title'), ''),
                nullif(btrim(item->'tour'->>'name'), ''),
                nullif(btrim(item->'tour'->'package'->>'name'), ''),
                item->'floatingTour'->'package'->>'name') AS "sourceTitle",
            e.title, e.summary, e.description, coalesce(e.hidden, false) AS hidden
        FROM rubi_catalog_receipt,
        LATERAL jsonb_array_elements(snapshot->'data') AS products(item)
        LEFT JOIN avina_tour_editorial AS e ON e.kind = item->>'kind'
            AND e.resource_id = item->>'resourceId'
        WHERE site = 'jahan-bastan' AND item->>'kind' IN ('tour', 'floating-tour')
            AND item->'enabled' = 'true'::jsonb
        ORDER BY item->>'kind', item->>'resourceId', item->>'id'
    """)
    )
    return [dict(row) for row in rows.mappings()]


async def save_tour_editorial(
    session: AsyncSession, kind: str, resource_id: str, values: dict
) -> bool:
    updated = await session.scalar(
        text("""
        INSERT INTO avina_tour_editorial
            (kind, resource_id, title, summary, description, hidden)
        SELECT :kind, :resource_id, :title, :summary, :description, :hidden
        WHERE EXISTS (
            SELECT 1 FROM rubi_catalog_receipt,
            LATERAL jsonb_array_elements(snapshot->'data') AS products(item)
            WHERE site = 'jahan-bastan' AND item->>'kind' = :kind
              AND item->>'resourceId' = :resource_id AND item->'enabled' = 'true'::jsonb
        )
        ON CONFLICT (kind, resource_id) DO UPDATE SET
            title = excluded.title, summary = excluded.summary,
            description = excluded.description, hidden = excluded.hidden
        RETURNING resource_id
    """),
        {"kind": kind, "resource_id": resource_id, **values},
    )
    await session.commit()
    return updated is not None
