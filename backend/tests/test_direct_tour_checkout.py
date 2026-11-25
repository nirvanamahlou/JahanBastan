"""The direct checkout uses a separate cart and enforces the selected room mix."""

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import BookingRequest, CustomerUser
from app.repositories.bookings import BookingRepository, DirectRequestMismatch
from app.repositories.customer_commerce import CustomerCommerceRepository
from app.schemas.booking import BookingCreate


def payload(price_field: str) -> dict:
    return {
        "tourSelection": {
            "itemType": "tour",
            "tourId": 4,
            "tourDepartureId": 5,
            price_field: 6,
            "roomSelection": {"single": 1},
        },
        "passengers": [
            {
                "firstName": "Test",
                "lastName": "Traveler",
                "nationalCode": "0000000001",
                "birthDate": "1990-01-01",
                "gender": "female",
                "passengerType": "adult",
            }
        ],
    }


def test_direct_purchase_requires_the_selected_passenger_mix() -> None:
    request = payload("tourHotelPriceId")
    request["passengers"][0]["passengerType"] = "child"
    with pytest.raises(ValidationError, match="passengers do not match"):
        BookingCreate.model_validate(request)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "method"),
    [
        ("tourHotelPriceId", "add_tour"),
        ("combinedDeparturePriceId", "add_combined_tour"),
    ],
)
async def test_direct_purchase_isolates_the_selected_item(field, method, monkeypatch):
    selection = BookingCreate.model_validate(payload(field)).tour_selection
    session = MagicMock()
    session.flush = AsyncMock()
    session.add.side_effect = lambda cart: setattr(cart, "id", 19)
    add_item = AsyncMock(return_value=object())
    monkeypatch.setattr(CustomerCommerceRepository, method, add_item)
    repo = BookingRepository(session)
    cart = await repo._direct_tour_cart(12, selection)
    assert cart.customer_id == 12
    assert cart.status == "abandoned"
    add_item.assert_awaited_once_with(12, 4, 5, 6, {"single": 1}, cart_id=19)
    add_item.return_value = None
    with pytest.raises(ValueError):
        await repo._direct_tour_cart(12, selection)


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("ERP_CHECKOUT_TEST_DATABASE_URL"),
    reason="PostgreSQL test database required",
)
async def test_concurrent_and_retried_direct_confirmation_returns_one_order() -> None:
    engine = create_async_engine(os.environ["ERP_CHECKOUT_TEST_DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    key = str(uuid4())
    async with sessions.begin() as session:
        user = CustomerUser(
            email=f"{key}@example.test", full_name="Test Buyer", password_hash="test"
        )
        session.add(user)
        await session.flush()
        customer_id = user.id

    async def confirm() -> int:
        async with sessions.begin() as session:
            repo = BookingRepository(session)
            replay = await repo.find_direct_replay(customer_id, key, "a" * 64)
            if replay is not None:
                return replay.id
            # Both transactions enter the replay lookup before the first one commits.
            await asyncio.sleep(0.05)
            booking = BookingRequest(
                customer_id=customer_id,
                booking_number=f"TEST-{key[:18]}",
                currency="IRT",
                direct_request_key=key,
                direct_request_digest="a" * 64,
            )
            session.add(booking)
            await session.flush()
            return booking.id

    try:
        first, second = await asyncio.gather(confirm(), confirm())
        assert first == second == await confirm()
        async with sessions.begin() as session:
            repo = BookingRepository(session)
            with pytest.raises(DirectRequestMismatch):
                await repo.find_direct_replay(customer_id, key, "b" * 64)
            assert await repo.find_direct_replay(customer_id + 1, key, "a" * 64) is None
    finally:
        async with sessions.begin() as session:
            await session.execute(
                delete(BookingRequest).where(BookingRequest.customer_id == customer_id)
            )
            await session.execute(
                delete(CustomerUser).where(CustomerUser.id == customer_id)
            )
        await engine.dispose()
