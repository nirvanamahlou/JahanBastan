"""Authenticated editorial management endpoints."""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select

from app.api.dependencies.auth import CurrentAdmin, DatabaseSession, TrustedOrigin
from app.models import (
    ArticleCategory,
    Hotel,
    PublicationStatus,
    TravelService,
)
from app.repositories import rubi_catalog
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
from app.services import editorial_management_commands as commands

router = APIRouter(prefix="/admin", tags=["admin-editorial"])
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


@router.get("/article-categories", response_model=list[AdminArticleCategory])
async def list_article_categories(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminArticleCategory]:
    return await commands.list_article_categories(session, _admin)


@router.post(
    "/article-categories", response_model=AdminArticleCategory, status_code=201
)
async def create_article_category(
    payload: ArticleCategoryWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticleCategory:
    return await commands.create_article_category(payload, session, _admin, _origin)


@router.patch("/article-categories/{categoryId}", response_model=AdminArticleCategory)
async def update_article_category(
    category_id: Annotated[int, Path(alias="categoryId", ge=1)],
    payload: ArticleCategoryUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticleCategory:
    return await commands.update_article_category(
        category_id, payload, session, _admin, _origin
    )


@router.delete("/article-categories/{categoryId}", status_code=204)
async def delete_article_category(
    category_id: Annotated[int, Path(alias="categoryId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_article_category(category_id, session, _admin, _origin)


@router.get("/articles", response_model=list[AdminArticle])
async def list_articles(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminArticle]:
    return await commands.list_articles(session, _admin)


@router.post("/articles", response_model=AdminArticle, status_code=201)
async def create_article(
    payload: ArticleWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticle:
    return await commands.create_article(payload, session, _admin, _origin)


@router.patch("/articles/{articleId}", response_model=AdminArticle)
async def update_article(
    article_id: Annotated[int, Path(alias="articleId", ge=1)],
    payload: ArticleUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminArticle:
    return await commands.update_article(article_id, payload, session, _admin, _origin)


@router.delete("/articles/{articleId}", status_code=204)
async def delete_article(
    article_id: Annotated[int, Path(alias="articleId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_article(article_id, session, _admin, _origin)


@router.get("/faqs", response_model=list[AdminFAQ])
async def list_faqs(session: DatabaseSession, _admin: CurrentAdmin) -> list[AdminFAQ]:
    return await commands.list_faqs(session, _admin)


@router.post("/faqs", response_model=AdminFAQ, status_code=201)
async def create_faq(
    payload: FAQWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminFAQ:
    return await commands.create_faq(payload, session, _admin, _origin)


@router.patch("/faqs/{faqId}", response_model=AdminFAQ)
async def update_faq(
    faq_id: Annotated[int, Path(alias="faqId", ge=1)],
    payload: FAQUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminFAQ:
    return await commands.update_faq(faq_id, payload, session, _admin, _origin)


@router.delete("/faqs/{faqId}", status_code=204)
async def delete_faq(
    faq_id: Annotated[int, Path(alias="faqId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_faq(faq_id, session, _admin, _origin)


@router.get("/settings", response_model=SiteSettingsResponse)
async def get_site_settings(
    session: DatabaseSession, _admin: CurrentAdmin
) -> SiteSettingsResponse:
    return await commands.get_site_settings(session, _admin)


@router.put("/settings", response_model=SiteSettingsResponse)
async def update_site_settings(
    payload: SiteSettingsWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> SiteSettingsResponse:
    return await commands.update_site_settings(payload, session, _admin, _origin)


class AvinaTourEditorialWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str | None = Field(default=None, max_length=180)
    summary: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=20000)
    hidden: bool = False


class AvinaTourEditorial(AvinaTourEditorialWrite):
    kind: Literal["tour", "floating-tour"]
    resourceId: UUID
    sourceTitle: str | None


@router.get("/avina-tours", response_model=list[AvinaTourEditorial])
async def list_avina_tours(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[dict]:
    return await rubi_catalog.editorial_tours(session)


@router.put("/avina-tours/{kind}/{resource_id}", status_code=204)
async def update_avina_tour(
    kind: Literal["tour", "floating-tour"],
    resource_id: UUID,
    payload: AvinaTourEditorialWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> Response:
    if not await rubi_catalog.save_tour_editorial(
        session, kind, str(resource_id), payload.model_dump()
    ):
        raise HTTPException(404, "تور آوینا پیدا نشد.")
    return Response(status_code=204)


@router.get("/tours", response_model=list[AdminTour])
async def list_admin_tours(
    session: DatabaseSession, _admin: CurrentAdmin
) -> list[AdminTour]:
    return await commands.list_admin_tours(session, _admin)


@router.post("/tours", response_model=AdminTour, status_code=201)
async def create_admin_tour(
    payload: TourWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTour:
    return await commands.create_admin_tour(payload, session, _admin, _origin)


@router.get("/tours/{tourId}/package.pdf", response_class=Response)
async def download_admin_tour_package(
    tour_id: Annotated[int, Path(alias="tourId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
) -> Response:
    return await commands.download_admin_tour_package(tour_id, session, _admin)


@router.patch("/tours/{tourId}", response_model=AdminTour)
async def update_admin_tour(
    tour_id: Annotated[int, Path(alias="tourId", ge=1)],
    payload: TourUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTour:
    return await commands.update_admin_tour(tour_id, payload, session, _admin, _origin)


@router.delete("/tours/{tourId}", status_code=204)
async def delete_admin_tour(
    tour_id: Annotated[int, Path(alias="tourId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_admin_tour(tour_id, session, _admin, _origin)


@router.get("/services", response_model=list[AdminTravelService])
async def list_admin_services(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AdminTravelService]:
    return await commands.list_admin_services(session, _admin, offset, limit)


@router.post("/services", response_model=AdminTravelService, status_code=201)
async def create_admin_service(
    payload: TravelServiceWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTravelService:
    return await commands.create_admin_service(payload, session, _admin, _origin)


@router.patch("/services/{serviceId}", response_model=AdminTravelService)
async def update_admin_service(
    service_id: Annotated[int, Path(alias="serviceId", ge=1)],
    payload: TravelServiceUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminTravelService:
    return await commands.update_admin_service(
        service_id, payload, session, _admin, _origin
    )


@router.delete("/services/{serviceId}", status_code=204)
async def delete_admin_service(
    service_id: Annotated[int, Path(alias="serviceId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_admin_service(service_id, session, _admin, _origin)


@router.get("/hotels", response_model=list[AdminHotel])
async def list_admin_hotels(
    session: DatabaseSession,
    _admin: CurrentAdmin,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AdminHotel]:
    return await commands.list_admin_hotels(session, _admin, offset, limit)


@router.post("/hotels", response_model=AdminHotel, status_code=201)
async def create_admin_hotel(
    payload: HotelWrite,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminHotel:
    return await commands.create_admin_hotel(payload, session, _admin, _origin)


@router.patch("/hotels/{hotelId}", response_model=AdminHotel)
async def update_admin_hotel(
    hotel_id: Annotated[int, Path(alias="hotelId", ge=1)],
    payload: HotelUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminHotel:
    return await commands.update_admin_hotel(
        hotel_id, payload, session, _admin, _origin
    )


@router.patch("/hotels/{hotelId}/media", response_model=AdminHotel)
async def update_admin_hotel_media(
    hotel_id: Annotated[int, Path(alias="hotelId", ge=1)],
    payload: HotelMediaUpdate,
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> AdminHotel:
    return await commands.update_admin_hotel_media(
        hotel_id, payload, session, _admin, _origin
    )


@router.delete("/hotels/{hotelId}", status_code=204)
async def delete_admin_hotel(
    hotel_id: Annotated[int, Path(alias="hotelId", ge=1)],
    session: DatabaseSession,
    _admin: CurrentAdmin,
    _origin: TrustedOrigin,
) -> None:
    return await commands.delete_admin_hotel(hotel_id, session, _admin, _origin)
