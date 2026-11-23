import os
import time
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from app.api.dependencies.auth import DatabaseSession
from app.repositories.avina_hotels import publish, publish_geography
from app.services.avina_hotel_media import prepare_flag, prepare_hotel_images
from app.services.rubi_catalog import valid_signature

router = APIRouter(prefix="/erp", tags=["hotels"])
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)
]


class HotelProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    site: Literal["jahan-bastan"]
    kind: Literal["hotel-profile"]
    identificationCode: str = Field(min_length=1, max_length=64)
    name: Name
    cityName: Name
    countryName: Name
    starRating: int = Field(ge=1, le=5)
    address: str | None = Field(default=None, max_length=300)
    regionName: str | None = Field(default=None, max_length=120)
    facilityNames: str | None = None
    mealServiceNames: str | None = None
    roomTypeNames: str | None = None
    englishName: str | None = None
    chainName: str | None = None
    checkInTime: str | None = None
    checkOutTime: str | None = None
    website: str | None = None
    description: str | None = Field(default=None, max_length=20000)
    hotelRules: str | None = Field(default=None, max_length=10000)
    sourceRefundRules: str | None = Field(default=None, max_length=10000)
    sourceMainImage: str | None = Field(default=None, max_length=2000)
    sourceGalleryImages: str | None = Field(default=None, max_length=16000)


class GeographyProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    site: Literal["jahan-bastan"]
    kind: Literal["countries", "cities"]
    id: Annotated[str, StringConstraints(pattern=r"^[a-fA-F0-9-]{36}$")]
    name: str = Field(min_length=1, max_length=100)
    countryName: str | None = Field(default=None, max_length=100)
    flag: str | None = Field(default=None, max_length=500000)


async def signed_body(request: Request) -> bytes:
    key = os.getenv("JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET", "")
    if len(key) < 32:
        raise HTTPException(503, "Hotel delivery is not configured")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > 600000:
            raise HTTPException(413)
        body.extend(chunk)
    if not valid_signature(
        bytes(body),
        request.headers.get("x-erp-timestamp", ""),
        request.headers.get("x-erp-signature", ""),
        key,
        int(time.time()),
    ):
        raise HTTPException(401)
    return bytes(body)


@router.post("/hotel-profile")
async def hotel_profile(request: Request, session: DatabaseSession) -> dict[str, str]:
    body = await signed_body(request)
    try:
        profile = HotelProfile.model_validate_json(body)
        images = await prepare_hotel_images(
            profile.sourceMainImage, profile.sourceGalleryImages
        )
        slug = await publish(session, profile, images)
    except ValidationError as exc:
        raise HTTPException(422, "اطلاعات پایه هتل کامل یا معتبر نیست.") from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {"slug": slug, "identificationCode": profile.identificationCode}


@router.post("/geography-profile")
async def geography_profile(
    request: Request, session: DatabaseSession
) -> dict[str, str]:
    body = await signed_body(request)
    try:
        profile = GeographyProfile.model_validate_json(body)
        flag = await prepare_flag(profile.flag)
        slug = await publish_geography(session, profile, flag)
    except ValidationError as exc:
        raise HTTPException(422, "اطلاعات جغرافیایی کامل یا معتبر نیست.") from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {"slug": slug}
