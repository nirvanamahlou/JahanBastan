"""Authenticated editorial management endpoints."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import HTTPException, Path, Query, Response
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy import update as sql_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.dependencies.auth import CurrentAdmin, DatabaseSession, TrustedOrigin
from app.models import (
    FAQ,
    Article,
    ArticleCategory,
    Hotel,
    PublicationStatus,
    SiteSetting,
    Tour,
    TravelService,
)
from app.repositories.editorial import EditorialRepository
from app.schemas.editorial_management import (
    AdminArticle,
    AdminArticleCategory,
    AdminFAQ,
    AdminHotel,
    AdminTour,
    AdminTravelService,
    ArticleCategoryUpdate,
    ArticleCategoryWrite,
    ArticleUpdate,
    ArticleWrite,
    FAQUpdate,
    FAQWrite,
    HotelMediaUpdate,
    HotelUpdate,
    HotelWrite,
    SiteSettingsResponse,
    SiteSettingsWrite,
    TourUpdate,
    TourWrite,
    TravelServiceUpdate,
    TravelServiceWrite,
)
from app.services.tour_pdf import create_tour_package_pdf

TOUR_COLLECTION_FIELDS = {
    "gallery_image_ids",
    "travel_legs",
    "itinerary_days",
    "departures",
    "hotel_packages",
    "combined_packages",
}


def publication_time(status: PublicationStatus) -> datetime | None:
    return datetime.now(UTC) if status == PublicationStatus.PUBLISHED else None


def validation_error(exc: ValidationError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail=exc.errors(include_url=False, include_context=False),
    )


def complete_write_payload(
    record: Hotel | TravelService,
    schema: type[HotelWrite] | type[TravelServiceWrite],
    updates: dict[str, object],
) -> dict[str, object]:
    original = {
        field: getattr(record, field)
        for field in schema.model_fields
        if field != "gallery_image_ids"
    }
    original["gallery_image_ids"] = record.gallery_image_ids
    values = {**original, **updates}
    try:
        return schema.model_validate(values).model_dump()
    except ValidationError as exc:
        # Existing editorial rows can predate stricter create-time rules. Permit
        # unrelated edits only when they do not add a new validation defect.
        try:
            schema.model_validate(original)
        except ValidationError as original_exc:
            original_errors = {
                (tuple(error["loc"]), error["type"], error["msg"])
                for error in original_exc.errors()
            }
            updated_errors = {
                (tuple(error["loc"]), error["type"], error["msg"])
                for error in exc.errors()
            }
            if updated_errors.issubset(original_errors):
                return values
        raise validation_error(exc) from exc


async def require_article_category(
    session: DatabaseSession, name: str
) -> ArticleCategory:
    category = await session.scalar(
        select(ArticleCategory).where(ArticleCategory.name == name)
    )
    if category is None:
        raise HTTPException(422, "article category must be created first")
    return category


async def list_article_categories(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminArticleCategory]:
    rows = await session.scalars(select(ArticleCategory).order_by(ArticleCategory.name))
    return [AdminArticleCategory.model_validate(row) for row in rows]


async def create_article_category(
    payload: ArticleCategoryWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticleCategory:
    category = ArticleCategory(**payload.model_dump())
    session.add(category)
    try:
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "category name or slug is already used") from exc
    await session.refresh(category)
    return AdminArticleCategory.model_validate(category)


async def update_article_category(
    category_id: Annotated[int, Path(alias="categoryId", ge=1)],
    payload: ArticleCategoryUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticleCategory:
    category = await session.get(ArticleCategory, category_id)
    if category is None:
        raise HTTPException(404, "article category not found")
    old_name = category.name
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    if category.name != old_name:
        await session.execute(
            sql_update(Article)
            .where(Article.category == old_name)
            .values(category=category.name)
        )
    try:
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "category name or slug is already used") from exc
    await session.refresh(category)
    return AdminArticleCategory.model_validate(category)


async def delete_article_category(
    category_id: Annotated[int, Path(alias="categoryId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    category = await session.get(ArticleCategory, category_id)
    if category is None:
        raise HTTPException(404, "article category not found")
    await session.execute(
        sql_update(Article)
        .where(Article.category == category.name)
        .values(category=None)
    )
    await session.execute(
        delete(ArticleCategory).where(ArticleCategory.id == category_id)
    )
    await finish_catalog_command(session)


async def list_articles(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminArticle]:
    rows = await EditorialRepository(session).list_articles()
    return [AdminArticle.model_validate(row) for row in rows]


async def create_article(
    payload: ArticleWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticle:
    await require_article_category(session, payload.category)
    values = payload.model_dump(exclude={"gallery_image_ids"})
    article = Article(
        **values,
        published_at=publication_time(payload.status),
    )
    session.add(article)
    try:
        await session.flush()
        await EditorialRepository(session).replace_gallery(
            article, payload.gallery_image_ids
        )
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409, "article slug is already used or an image is invalid"
        ) from exc
    await session.refresh(article, attribute_names=["gallery", "updated_at"])
    return AdminArticle.model_validate(article)


async def update_article(
    article_id: Annotated[int, Path(alias="articleId", ge=1)],
    payload: ArticleUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticle:
    repository = EditorialRepository(session)
    article = await session.scalar(
        select(Article)
        .options(selectinload(Article.gallery))
        .where(Article.id == article_id)
    )
    if article is None:
        raise HTTPException(404, "article not found")
    if payload.category is not None:
        await require_article_category(session, payload.category)
    for field, value in payload.model_dump(
        exclude_unset=True, exclude={"gallery_image_ids"}
    ).items():
        setattr(article, field, value)
    if payload.status == PublicationStatus.PUBLISHED and article.published_at is None:
        article.published_at = datetime.now(UTC)
    if payload.gallery_image_ids is not None:
        await repository.replace_gallery(article, payload.gallery_image_ids)
    try:
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "article slug, image, or relation is invalid") from exc
    await session.refresh(article, attribute_names=["gallery", "updated_at"])
    return AdminArticle.model_validate(article)


async def delete_article(
    article_id: Annotated[int, Path(alias="articleId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    article = await session.get(Article, article_id)
    if article is None:
        raise HTTPException(404, "article not found")
    await session.execute(delete(Article).where(Article.id == article_id))
    await finish_catalog_command(session)


async def list_faqs(session: DatabaseSession, _admin: CurrentAdmin) -> list[AdminFAQ]:
    rows = await EditorialRepository(session).list_faqs()
    return [AdminFAQ.model_validate(row) for row in rows]


async def create_faq(
    payload: FAQWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminFAQ:
    faq = FAQ(**payload.model_dump(), published_at=publication_time(payload.status))
    session.add(faq)
    try:
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "FAQ relation is invalid") from exc
    await session.refresh(faq)
    return AdminFAQ.model_validate(faq)


async def update_faq(
    faq_id: Annotated[int, Path(alias="faqId", ge=1)],
    payload: FAQUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminFAQ:
    faq = await session.get(FAQ, faq_id)
    if faq is None:
        raise HTTPException(404, "FAQ not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)
    if payload.status == PublicationStatus.PUBLISHED and faq.published_at is None:
        faq.published_at = datetime.now(UTC)
    await finish_catalog_command(session)
    await session.refresh(faq)
    return AdminFAQ.model_validate(faq)


async def delete_faq(
    faq_id: Annotated[int, Path(alias="faqId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    faq = await session.get(FAQ, faq_id)
    if faq is None:
        raise HTTPException(404, "FAQ not found")
    await session.execute(delete(FAQ).where(FAQ.id == faq_id))
    await finish_catalog_command(session)


async def get_site_settings(
    session: DatabaseSession, _admin: CurrentAdmin
) -> SiteSettingsResponse:
    settings = await EditorialRepository(session).get_settings()
    if settings is None:
        raise HTTPException(404, "site settings not initialized")
    return SiteSettingsResponse.model_validate(settings)


async def update_site_settings(
    payload: SiteSettingsWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> SiteSettingsResponse:
    settings = await EditorialRepository(session).get_settings()
    if settings is None:
        settings = SiteSetting(id=1, **payload.model_dump())
        session.add(settings)
    else:
        for field, value in payload.model_dump().items():
            setattr(settings, field, value)
    await finish_catalog_command(session)
    await session.refresh(settings)
    return SiteSettingsResponse.model_validate(settings)


async def list_admin_tours(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminTour]:
    rows = await EditorialRepository(session).list_tours()
    return [AdminTour.model_validate(row) for row in rows]


async def create_admin_tour(
    payload: TourWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTour:
    now = datetime.now(UTC)
    values = payload.model_dump(exclude=TOUR_COLLECTION_FIELDS)
    tour = Tour(
        **values,
        external_crm_id=f"admin-{now.timestamp():.6f}",
        crm_updated_at=now,
        published_at=publication_time(payload.status),
    )
    session.add(tour)
    try:
        await session.flush()
        await EditorialRepository(session).replace_tour_gallery(
            tour, payload.gallery_image_ids
        )
        await EditorialRepository(session).replace_tour_details(
            tour,
            travel_legs=[item.model_dump() for item in payload.travel_legs],
            itinerary_days=[item.model_dump() for item in payload.itinerary_days],
            departures=[item.model_dump() for item in payload.departures],
            hotel_packages=[item.model_dump() for item in payload.hotel_packages],
            combined_packages=[item.model_dump() for item in payload.combined_packages],
        )
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "tour slug, hotel, or destination is invalid") from exc
    saved = await EditorialRepository(session).get_tour(tour.id)
    return AdminTour.model_validate(saved)


async def download_admin_tour_package(
    tour_id: Annotated[int, Path(alias="tourId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
) -> Response:
    """Download an administrative package, including the internal note when set."""
    tour = await EditorialRepository(session).get_tour(tour_id)
    if tour is None:
        raise HTTPException(404, "tour not found")
    pdf = await create_tour_package_pdf(session, tour, include_internal_note=True)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="tour-package-admin.pdf"'
        },
    )


async def update_admin_tour(
    tour_id: Annotated[int, Path(alias="tourId", ge=1)],
    payload: TourUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTour:
    repository = EditorialRepository(session)
    tour = await repository.get_tour(tour_id)
    if tour is None:
        raise HTTPException(404, "tour not found")
    values = payload.model_dump(
        exclude_unset=True,
        exclude=TOUR_COLLECTION_FIELDS,
    )
    for field, value in values.items():
        setattr(tour, field, value)
    if payload.status == PublicationStatus.PUBLISHED and tour.published_at is None:
        tour.published_at = datetime.now(UTC)
    try:
        if payload.gallery_image_ids is not None:
            await repository.replace_tour_gallery(tour, payload.gallery_image_ids)
        await repository.replace_tour_details(
            tour,
            travel_legs=(
                [item.model_dump() for item in payload.travel_legs]
                if payload.travel_legs is not None
                else None
            ),
            itinerary_days=(
                [item.model_dump() for item in payload.itinerary_days]
                if payload.itinerary_days is not None
                else None
            ),
            departures=(
                [item.model_dump() for item in payload.departures]
                if payload.departures is not None
                else None
            ),
            hotel_packages=(
                [item.model_dump() for item in payload.hotel_packages]
                if payload.hotel_packages is not None
                else None
            ),
            combined_packages=(
                [item.model_dump() for item in payload.combined_packages]
                if payload.combined_packages is not None
                else None
            ),
        )
        tour.crm_updated_at = datetime.now(UTC)
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "tour slug, hotel, or destination is invalid") from exc
    saved = await repository.get_tour(tour.id)
    return AdminTour.model_validate(saved)


async def delete_admin_tour(
    tour_id: Annotated[int, Path(alias="tourId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    tour = await EditorialRepository(session).get_tour(tour_id)
    if tour is None:
        raise HTTPException(404, "tour not found")
    try:
        await session.execute(delete(Tour).where(Tour.id == tour_id))
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409,
            "تور اطلاعات وابسته دارد؛ ابتدا داده‌های وابسته را مدیریت کنید.",
        ) from exc


async def list_admin_services(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AdminTravelService]:
    rows = await EditorialRepository(session).list_services(offset=offset, limit=limit)
    return [AdminTravelService.model_validate(row) for row in rows]


async def create_admin_service(
    payload: TravelServiceWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTravelService:
    values = payload.model_dump(exclude={"gallery_image_ids"})
    service = TravelService(
        **values,
        published_at=publication_time(payload.status),
    )
    session.add(service)
    await session.flush()
    await EditorialRepository(session).replace_gallery(
        service, payload.gallery_image_ids
    )
    try:
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "service slug is already in use") from exc
    await session.refresh(service, attribute_names=["gallery", "updated_at"])
    return AdminTravelService.model_validate(service)


async def update_admin_service(
    service_id: Annotated[int, Path(alias="serviceId", ge=1)],
    payload: TravelServiceUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTravelService:
    repository = EditorialRepository(session)
    service = await session.scalar(
        select(TravelService)
        .options(selectinload(TravelService.gallery))
        .where(TravelService.id == service_id)
    )
    if service is None:
        raise HTTPException(404, "service not found")
    updates = payload.model_dump(exclude_unset=True)
    validated = complete_write_payload(service, TravelServiceWrite, updates)
    for field, value in validated.items():
        if field == "gallery_image_ids":
            continue
        setattr(service, field, value)
    if payload.status == PublicationStatus.PUBLISHED and service.published_at is None:
        service.published_at = datetime.now(UTC)
    try:
        if payload.gallery_image_ids is not None:
            await repository.replace_gallery(service, payload.gallery_image_ids)
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "service slug or image is invalid") from exc
    await session.refresh(service, attribute_names=["gallery", "updated_at"])
    return AdminTravelService.model_validate(service)


async def delete_admin_service(
    service_id: Annotated[int, Path(alias="serviceId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    service = await session.get(TravelService, service_id)
    if service is None:
        raise HTTPException(404, "service not found")
    await session.execute(delete(TravelService).where(TravelService.id == service_id))
    await finish_catalog_command(session)


async def list_admin_hotels(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AdminHotel]:
    rows = await EditorialRepository(session).list_hotels(offset=offset, limit=limit)
    return [AdminHotel.model_validate(row) for row in rows]


async def create_admin_hotel(
    payload: HotelWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminHotel:
    values = payload.model_dump(
        exclude={"gallery_image_ids", "room_types", "price_periods"}
    )
    hotel = Hotel(**values, published_at=publication_time(payload.status))
    session.add(hotel)
    try:
        await session.flush()
        await session.refresh(hotel, attribute_names=["hotel_code"])
        if hotel.hotel_code is None:
            hotel.hotel_code = f"HTL-{hotel.id:03d}"
        repository = EditorialRepository(session)
        await repository.replace_gallery(hotel, payload.gallery_image_ids)
        await repository.replace_hotel_room_types(
            hotel, payload.model_dump()["room_types"]
        )
        await repository.replace_hotel_price_periods(
            hotel, payload.model_dump()["price_periods"]
        )
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409, "hotel slug, destination, or image is invalid"
        ) from exc
    await session.refresh(
        hotel, attribute_names=["gallery", "room_types", "price_periods", "updated_at"]
    )
    return AdminHotel.model_validate(hotel)


async def update_admin_hotel(
    hotel_id: Annotated[int, Path(alias="hotelId", ge=1)],
    payload: HotelUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminHotel:
    repository = EditorialRepository(session)
    hotel = await repository.get_hotel(hotel_id)
    if hotel is None:
        raise HTTPException(404, "hotel not found")
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field in {"gallery_image_ids", "room_types", "price_periods"}:
            continue
        setattr(hotel, field, value)
    if payload.status == PublicationStatus.PUBLISHED and hotel.published_at is None:
        hotel.published_at = datetime.now(UTC)
    try:
        if payload.gallery_image_ids is not None:
            await repository.replace_gallery(hotel, payload.gallery_image_ids)
        if payload.room_types is not None:
            await repository.replace_hotel_room_types(
                hotel,
                [room.model_dump() for room in payload.room_types],
            )
        if payload.price_periods is not None:
            await repository.replace_hotel_price_periods(
                hotel,
                [period.model_dump() for period in payload.price_periods],
            )
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409, "hotel slug, destination, or image is invalid"
        ) from exc
    await session.refresh(
        hotel,
        attribute_names=[
            "gallery",
            "room_types",
            "price_periods",
            "updated_at",
            "hotel_code",
        ],
    )
    return AdminHotel.model_validate(hotel)


async def update_admin_hotel_media(
    hotel_id: Annotated[int, Path(alias="hotelId", ge=1)],
    payload: HotelMediaUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminHotel:
    """Update hotel media without validating unrelated imported sheet fields."""
    repository = EditorialRepository(session)
    hotel = await repository.get_hotel(hotel_id)
    if hotel is None:
        raise HTTPException(404, "hotel not found")
    hotel.image_id = payload.image_id
    try:
        await repository.replace_gallery(hotel, payload.gallery_image_ids)
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "hotel image is invalid") from exc
    await session.refresh(
        hotel, attribute_names=["gallery", "room_types", "price_periods", "updated_at"]
    )
    return AdminHotel.model_validate(hotel)


async def delete_admin_hotel(
    hotel_id: Annotated[int, Path(alias="hotelId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    hotel = await session.get(Hotel, hotel_id)
    if hotel is None:
        raise HTTPException(404, "hotel not found")
    try:
        await session.execute(delete(Hotel).where(Hotel.id == hotel_id))
        await finish_catalog_command(session)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409,
            "هتل اطلاعات وابسته دارد؛ ابتدا داده‌های وابسته را مدیریت کنید.",
        ) from exc


async def finish_catalog_command(session: DatabaseSession) -> None:
    """Let the connector commit native changes and the replay result atomically."""
    if isinstance(session.info, dict) and session.info.get("nora_atomic") is True:
        await session.flush()
    else:
        await session.commit()
