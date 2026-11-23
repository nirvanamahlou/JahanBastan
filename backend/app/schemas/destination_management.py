"""Admin destination and media contracts."""

from datetime import datetime

from pydantic import Field

from app.models import PublicationStatus
from app.schemas.catalog import CatalogSchema, DestinationDetail


class DestinationWrite(CatalogSchema):
    title: str = Field(min_length=2, max_length=160)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180)
    country: str = Field(min_length=2, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    summary: str = Field(min_length=10, max_length=300)
    description: str = Field(min_length=20)
    internal_note: str | None = Field(default=None, max_length=5000)
    attractions: str | None = None
    best_travel_time: str | None = Field(default=None, max_length=160)
    travel_tips: str | None = None
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] = Field(default_factory=list, max_length=6)
    is_featured: bool = False
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)
    status: PublicationStatus = PublicationStatus.DRAFT


class DestinationUpdate(CatalogSchema):
    slug: str | None = Field(
        default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180
    )
    title: str | None = Field(default=None, min_length=2, max_length=160)
    country: str | None = Field(default=None, min_length=2, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    summary: str | None = Field(default=None, min_length=10, max_length=300)
    description: str | None = Field(default=None, min_length=20)
    internal_note: str | None = Field(default=None, max_length=5000)
    attractions: str | None = None
    best_travel_time: str | None = Field(default=None, max_length=160)
    travel_tips: str | None = None
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] | None = Field(default=None, max_length=6)
    is_featured: bool | None = None
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)
    status: PublicationStatus | None = None


class AdminDestination(DestinationDetail):
    internal_note: str | None = Field(default=None, max_length=5000)
    status: PublicationStatus
    published_at: datetime | None


class MediaAssetResponse(CatalogSchema):
    id: int
    storage_key: str
    original_name: str
    mime_type: str
    byte_size: int
    width: int
    height: int
    alt_text: str
    created_at: datetime


class CountryWrite(CatalogSchema):
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)
    internal_note: str | None = Field(default=None, max_length=5000)
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] = Field(default_factory=list, max_length=6)
    display_order: int = Field(default=0, ge=0, le=32767)
    status: PublicationStatus = PublicationStatus.DRAFT


class CountryUpdate(CatalogSchema):
    slug: str | None = Field(
        default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120
    )
    name: str | None = Field(default=None, min_length=2, max_length=100)
    internal_note: str | None = Field(default=None, max_length=5000)
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] | None = Field(default=None, max_length=6)
    display_order: int | None = Field(default=None, ge=0, le=32767)
    status: PublicationStatus | None = None


class AdminCountry(CountryWrite):
    id: int
    published_at: datetime | None
