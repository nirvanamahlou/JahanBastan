from typing import Annotated, Literal, Self
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.api.dependencies.auth import DatabaseSession
from app.api.routes.erp_hotels import signed_body
from app.repositories.avina_visas import publish_visa_profile
from app.services.avina_hotel_media import prepare_profile_images

router = APIRouter(prefix="/erp", tags=["visa profiles"])
DocumentName = Annotated[str, Field(min_length=1, max_length=160)]
ImageSource = Annotated[str, Field(min_length=1, max_length=2000)]


class VisaProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    site: Literal["jahan-bastan"]
    kind: Literal["visa-profile"]
    id: UUID
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    englishName: str | None = Field(default=None, max_length=160)
    countryName: str = Field(min_length=1, max_length=100)
    countryCode: str | None = Field(default=None, max_length=10)
    visaType: str = Field(min_length=1, max_length=120)
    referenceValidityDays: int | None = Field(default=None, ge=1, le=3650, strict=True)
    referenceValidityMode: Literal["DAYS", "PASSPORT_EXPIRY"]
    description: str | None = Field(default=None, max_length=1000)
    requiredDocuments: list[DocumentName] = Field(max_length=50)
    displayOrder: int = Field(ge=0, le=2147483647, strict=True)
    active: bool = Field(strict=True)
    sourceMainImage: ImageSource | None = None
    sourceGalleryImages: list[ImageSource] = Field(max_length=6)

    @model_validator(mode="after")
    def validate_validity_mode(self) -> Self:
        if (
            self.referenceValidityMode == "PASSPORT_EXPIRY"
            and self.referenceValidityDays
        ):
            raise ValueError("Passport expiry validity cannot have a fixed day count")
        return self


@router.post("/visa-profile")
async def visa_profile(request: Request, session: DatabaseSession) -> dict[str, str]:
    body = await signed_body(request)
    try:
        profile = VisaProfile.model_validate_json(body)
    except ValidationError as exc:
        raise HTTPException(422, "اطلاعات پایه ویزا کامل یا معتبر نیست.") from exc
    images = None
    try:
        if profile.active:
            images = await prepare_profile_images(
                profile.sourceMainImage,
                profile.sourceGalleryImages,
                subject="ویزا",
            )
    except TimeoutError as exc:
        raise HTTPException(504, "دریافت تصاویر ویزا در زمان مقرر انجام نشد.") from exc
    except ValueError as exc:
        raise HTTPException(422, "نشانی تصویر ویزا معتبر نیست.") from exc
    slug = await publish_visa_profile(session, profile, images)
    return {"slug": slug, "code": profile.code, "urlPath": f"/services/{slug}/"}
