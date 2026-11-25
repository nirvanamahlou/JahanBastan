from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import (
    Country,
    Destination,
    Hotel,
    HotelImage,
    MediaAsset,
    Tour,
    TourCombinedPackage,
    TourCombinedPackageHotel,
    TourDeparture,
    TourDepartureHotelPrice,
    TourHotelPackage,
    TravelService,
)
from app.services.avina_hotel_media import PreparedImage

if TYPE_CHECKING:
    from app.api.routes.erp_hotels import (
        GeographyProfile,
        HotelProfile,
        ProfileWithdrawal,
    )


async def register_image(session: AsyncSession, image: PreparedImage, name: str) -> int:
    await session.execute(
        insert(MediaAsset)
        .values(
            storage_key=image.key,
            original_name=image.key,
            mime_type="image/webp",
            byte_size=image.size,
            width=image.width,
            height=image.height,
            alt_text=name,
        )
        .on_conflict_do_nothing(index_elements=[MediaAsset.storage_key])
    )
    return (
        await session.execute(
            select(MediaAsset.id).where(MediaAsset.storage_key == image.key)
        )
    ).scalar_one()


async def publish(
    session: AsyncSession,
    profile: "HotelProfile",
    images: tuple[PreparedImage | None, list[PreparedImage]] | None = None,
) -> str:
    code = profile.identificationCode
    async with session.begin():
        await session.execute(
            select(func.pg_advisory_xact_lock(func.hashtextextended(code, 0)))
        )
        hotels = (
            await session.scalars(
                select(Hotel)
                .where(
                    or_(
                        Hotel.avina_identification_code == code,
                        Hotel.hotel_code == code,
                    )
                )
                .with_for_update()
            )
        ).all()
        if len(hotels) > 1 or (
            hotels and hotels[0].avina_identification_code not in (None, code)
        ):
            raise ValueError("کد شناسایی با یک هتل دیگر تداخل دارد.")
        destinations = (
            await session.scalars(
                select(Destination.id)
                .where(
                    Destination.country == profile.countryName,
                    Destination.status == "published",
                    or_(
                        Destination.city == profile.cityName,
                        Destination.title == profile.cityName,
                    ),
                )
                .limit(2)
            )
        ).all()
        if len(destinations) != 1:
            raise ValueError(
                "برای شهر و کشور هتل باید یک مقصد مشخص در سایت وجود داشته باشد."
            )
        hotel = (
            hotels[0]
            if hotels
            else Hotel(
                slug="hotel-" + uuid5(NAMESPACE_URL, "avina-hotel:" + code).hex,
                summary="",
                description="",
                hotel_code=code[:64],
            )
        )
        hotel.avina_identification_code = code
        hotel.avina_profile = profile.model_dump(
            include={
                "englishName",
                "chainName",
                "checkInTime",
                "checkOutTime",
                "website",
            },
            exclude_none=True,
        )
        hotel.destination_id = destinations[0]
        hotel.name = profile.name
        hotel.star_rating = profile.starRating
        hotel.city = profile.cityName
        for key, field in {
            "address": "address",
            "regionName": "region",
            "facilityNames": "amenities_description",
            "mealServiceNames": "dining_description",
            "roomTypeNames": "rooms_description",
            "description": "description",
            "hotelRules": "policies_description",
            "sourceRefundRules": "cancellation_policy",
        }.items():
            if key in profile.model_fields_set and (
                key not in {"description", "hotelRules", "sourceRefundRules"}
                or getattr(profile, key)
            ):
                setattr(hotel, field, getattr(profile, key))
        hotel.status = "published"
        hotel.published_at = hotel.published_at or datetime.now(UTC)
        session.add(hotel)
        if profile.description:
            hotel.summary = profile.description[:300]
        main, gallery = images or (None, [])
        if main:
            hotel.image_id = await register_image(session, main, profile.name)
            hotel.image_alt_text = profile.name
        await session.flush()
        if gallery:
            await session.refresh(hotel, ["gallery"])
            hotel.gallery.clear()
            await session.flush()
            hotel.gallery.extend(
                [
                    HotelImage(
                        image_id=await register_image(session, image, profile.name),
                        display_order=index,
                    )
                    for index, image in enumerate(gallery)
                ]
            )
        return hotel.slug


async def publish_geography(
    session: AsyncSession, profile: "GeographyProfile", flag: PreparedImage | None
) -> str:
    slug = ("country-" if profile.kind == "countries" else "city-") + profile.id
    async with session.begin():
        await session.execute(
            select(
                func.pg_advisory_xact_lock(
                    func.hashtextextended(
                        "avina-geo:" + (profile.countryName or profile.name), 0
                    )
                )
            )
        )
        if profile.kind == "countries":
            records = (
                await session.scalars(
                    select(Country).where(
                        or_(Country.slug == slug, Country.name == profile.name)
                    )
                )
            ).all()
            if len(records) > 1 or (records and records[0].name != profile.name):
                raise ValueError("نام کشور با رکورد دیگری تداخل دارد.")
            row = records[0] if records else Country(name=profile.name, slug=slug)
            if flag:
                row.image_id = await register_image(session, flag, profile.name)
        else:
            country = await session.scalar(
                select(Country).where(
                    Country.name == profile.countryName, Country.status == "published"
                )
            )
            if country is None:
                raise ValueError("ابتدا کشور شهر را در جهان باستان منتشر کنید.")
            records = (
                await session.scalars(
                    select(Destination).where(
                        or_(
                            Destination.slug == slug,
                            (Destination.country == country.name)
                            & or_(
                                Destination.city == profile.name,
                                Destination.title == profile.name,
                            ),
                        )
                    )
                )
            ).all()
            if len(records) > 1 or (
                records
                and (
                    records[0].country != country.name
                    or profile.name not in (records[0].city, records[0].title)
                )
            ):
                raise ValueError("شهر با مقصد دیگری در جهان باستان تداخل دارد.")
            row = (
                records[0]
                if records
                else Destination(
                    title=profile.name,
                    city=profile.name,
                    country=country.name,
                    slug=slug,
                    summary="",
                    description="",
                )
            )
        row.status = "published"
        row.published_at = row.published_at or datetime.now(UTC)
        session.add(row)
        await session.flush()
        return row.slug


async def withdraw_profile(session: AsyncSession, profile: "ProfileWithdrawal"):
    kind = profile.kind
    code = profile.identificationCode
    geography_key = profile.countryName if kind == "cities" else profile.name
    lock_key = code if kind == "hotels" else "avina-geo:" + (geography_key or "")
    if kind == "visa-services":
        lock_key = f"avina-visa:{profile.id}"
    if (kind == "hotels" and not code) or (kind == "cities" and not geography_key):
        return {"linked": False, "blocked": False}
    async with session.begin():
        if profile.action == "withdraw":
            await session.execute(
                select(func.pg_advisory_xact_lock(func.hashtextextended(lock_key, 0)))
            )
        if kind == "visa-services":
            query = select(TravelService).where(
                TravelService.avina_visa_service_id == UUID(profile.id)
            )
        elif kind == "hotels":
            query = select(Hotel).where(Hotel.avina_identification_code == code)
        elif kind == "countries":
            query = select(Country).where(
                or_(
                    Country.slug == f"country-{profile.id}",
                    Country.name == profile.name,
                )
            )
        else:
            query = select(Destination).where(
                or_(
                    Destination.slug == f"city-{profile.id}",
                    (Destination.country == geography_key)
                    & or_(
                        Destination.city == profile.name,
                        Destination.title == profile.name,
                    ),
                )
            )
        if profile.action == "withdraw":
            query = query.with_for_update()
        records = (await session.scalars(query.limit(2))).all()
        if len(records) > 1:
            raise ValueError("تطبیق پروفایل در جهان باستان یکتا نیست.")
        if kind == "visa-services" and (
            not records or records[0].status != "published"
        ):
            return {"linked": False, "blocked": False}
        if not records or records[0].status not in ("published", "archived"):
            return {"linked": False, "blocked": False}
        row = records[0]
        dependents = []
        if kind == "hotels":
            dependents = [
                select(Tour.id).where(
                    Tour.status == "published",
                    or_(
                        Tour.hotel_id == row.id,
                        Tour.hotel_packages.any(TourHotelPackage.hotel_id == row.id),
                        Tour.combined_packages.any(
                            TourCombinedPackage.hotels.any(
                                TourCombinedPackageHotel.hotel_id == row.id
                            )
                        ),
                        Tour.departures.any(
                            TourDeparture.hotel_prices.any(
                                TourDepartureHotelPrice.hotel_id == row.id
                            )
                        ),
                    ),
                )
            ]
        elif kind == "countries":
            dependents = [
                select(Destination.id).where(
                    Destination.country == row.name, Destination.status == "published"
                )
            ]
        elif kind == "cities":
            dependents = [
                select(model.id).where(
                    model.destination_id == row.id, model.status == "published"
                )
                for model in (Hotel, Tour)
            ]
        blocked = any(
            [await session.scalar(query.limit(1)) is not None for query in dependents]
        )
        if profile.action == "withdraw" and blocked:
            raise ValueError("محتوای منتشرشده به این مقصد وابسته است.")
        if profile.action == "withdraw":
            row.status = "archived"
        return {"linked": True, "blocked": blocked}
