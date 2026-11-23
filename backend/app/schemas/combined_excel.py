"""Validated admin preview and commit results for combined price imports."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.catalog import CatalogSchema


class ImportMessage(BaseModel):
    row: int = Field(ge=1)
    message: str


class CombinedPreviewHotel(BaseModel):
    name: str
    nights: int = Field(ge=1)
    service: str | None


class CombinedPreview(CatalogSchema):
    row: int = Field(ge=1)
    title: str
    departure_date: date
    hotels: list[CombinedPreviewHotel]
    prices: dict[str, Decimal | str | None]


class CombinedImportResult(CatalogSchema):
    rows: int = Field(ge=1)
    packages: int = Field(ge=1)
    created_departures: int = Field(ge=0)
    created_packages: int = Field(default=0, ge=0)
    warnings: list[ImportMessage]
    combinations: list[CombinedPreview]
