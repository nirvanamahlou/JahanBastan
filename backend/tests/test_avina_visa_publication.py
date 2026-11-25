"""Signed visa delivery, native persistence, and public projection."""

import hashlib
import hmac
import json
import time
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import erp_visas
from app.db.session import get_session
from app.main import create_application
from app.models.content import PublicationStatus, TravelService, TravelServiceImage
from app.repositories import avina_visas
from app.schemas.catalog import PublicVisaProfile
from app.services.avina_hotel_media import PreparedImage

SECRET = "local-visa-delivery-test-key-000000000"
PATH = "/api/v1/erp/visa-profile"
VISA_ID = UUID("17ca2c44-9dc3-493f-9c3f-8a884b7d4e3e")


@pytest.fixture
def visa():
    return {
        "site": "jahan-bastan",
        "kind": "visa-profile",
        "id": str(VISA_ID),
        "code": "VSA-FRA-01",
        "name": "ویزای فرانسه",
        "englishName": "France visa",
        "countryName": "فرانسه",
        "countryCode": "FR",
        "visaType": "توریستی",
        "referenceValidityDays": 30,
        "referenceValidityMode": "DAYS",
        "description": "توضیحات ویزا",
        "requiredDocuments": ["گذرنامه", "عکس", "گذرنامه"],
        "displayOrder": 50_000,
        "active": True,
        "sourceMainImage": None,
        "sourceGalleryImages": [],
    }


def deliver(client, visa, *, signed_with=SECRET):
    body = json.dumps(visa).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(
        signed_with.encode(), timestamp.encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    return client.post(
        PATH,
        content=body,
        headers={"x-erp-timestamp": timestamp, "x-erp-signature": signature},
    )


def test_signed_route_validates_delivery_before_writes(monkeypatch, visa):
    monkeypatch.setenv("JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET", SECRET)
    app = create_application()
    app.dependency_overrides[get_session] = lambda: object()
    client = TestClient(app)
    slug = f"visa-{VISA_ID.hex}"
    publish = AsyncMock(return_value=slug)
    monkeypatch.setattr(erp_visas, "publish_visa_profile", publish)

    assert deliver(client, visa, signed_with="invalid").status_code == 401
    assert deliver(client, {**visa, "site": "other"}).status_code == 422
    assert (
        deliver(
            client, {**visa, "sourceMainImage": "https://unapproved.example/image.webp"}
        ).status_code
        == 422
    )
    assert (
        deliver(client, {**visa, "sourceGalleryImages": ["/img.webp"] * 7}).status_code
        == 422
    )
    assert (
        deliver(
            client, {**visa, "referenceValidityMode": "PASSPORT_EXPIRY"}
        ).status_code
        == 422
    )
    assert publish.await_count == 0

    result = deliver(client, visa)
    assert result.status_code == 200
    assert result.json() == {
        "slug": slug,
        "code": visa["code"],
        "urlPath": f"/services/{slug}/",
    }
    assert publish.await_args.args[1].id == VISA_ID
    assert publish.await_args.args[2] == (None, [])

    deactivated = deliver(
        client,
        {
            **visa,
            "active": False,
            "sourceMainImage": "https://unapproved.example/x.webp",
        },
    )
    assert deactivated.status_code == 200
    assert not publish.await_args.args[1].active
    assert publish.await_args.args[2] is None


@pytest.mark.asyncio
async def test_republication_updates_source_data_and_preserves_native_pricing(
    monkeypatch, visa
):
    item = TravelService(
        slug="existing-visa",
        base_price=Decimal(120000),
        visa_processing_time="سه روز کاری",
        visa_document_requirements=["passport"],
        gallery=[TravelServiceImage(image_id=5, display_order=0)],
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar.return_value = item
    monkeypatch.setattr(avina_visas, "register_image", AsyncMock(side_effect=[11, 12]))
    images = (PreparedImage("main", 20, 2, 2), [PreparedImage("photo", 20, 2, 2)])

    profile = erp_visas.VisaProfile.model_validate(visa)
    assert await avina_visas.publish_visa_profile(session, profile, images) == item.slug
    assert item.status == PublicationStatus.PUBLISHED
    assert item.image_id == 11
    assert item.gallery_image_ids == [12]
    assert item.base_price == Decimal(120000)
    assert item.visa_processing_time == "سه روز کاری"
    assert item.visa_document_requirements == ["passport"]
    assert PublicVisaProfile.model_validate(item.avina_visa_profile).model_dump(
        by_alias=True
    ) == {
        "code": "VSA-FRA-01",
        "englishName": "France visa",
        "countryCode": "FR",
        "visaType": "توریستی",
        "referenceValidityDays": 30,
        "referenceValidityMode": "DAYS",
        "requiredDocuments": ["گذرنامه", "عکس"],
    }

    profile = erp_visas.VisaProfile.model_validate({**visa, "active": False})
    await avina_visas.publish_visa_profile(session, profile, None)
    assert item.status == PublicationStatus.DRAFT
    assert item.published_at is None
    assert item.image_id == 11 and item.gallery_image_ids == [12]
