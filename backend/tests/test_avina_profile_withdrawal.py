from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.erp_hotels import ProfileWithdrawal
from app.repositories.avina_hotels import withdraw_profile


@pytest.mark.asyncio
async def test_profile_withdrawal_retains_dependent_country_and_archives_hotel():
    session = MagicMock(spec=AsyncSession)
    row = SimpleNamespace(status="published", name="ترکیه", id=42)
    session.scalars = AsyncMock(return_value=MagicMock(all=lambda: [row]))
    session.scalar = AsyncMock(return_value=42)
    profile = ProfileWithdrawal(
        site="jahan-bastan",
        kind="countries",
        action="inspect",
        id="be961690-3904-44d0-b29c-1f46f3fcb9fa",
        name="ترکیه",
    )
    assert await withdraw_profile(session, profile) == {"linked": True, "blocked": True}
    session.execute.assert_not_awaited()
    assert row.status == "published"
    with pytest.raises(ValueError, match="وابسته"):
        await withdraw_profile(
            session, profile.model_copy(update={"action": "withdraw"})
        )
    hotel = profile.model_copy(
        update={
            "kind": "hotels",
            "action": "withdraw",
            "identificationCode": "HTL-AYT-999",
        }
    )
    session.scalar.return_value = None
    for _ in range(2):
        assert await withdraw_profile(session, hotel) == {
            "linked": True,
            "blocked": False,
        }
    assert row.status == "archived"
    session.delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_visa_can_be_withdrawn_twice_by_avina_id():
    session = MagicMock(spec=AsyncSession)
    row = SimpleNamespace(status="published")
    session.scalars = AsyncMock(return_value=MagicMock(all=lambda: [row]))
    profile = ProfileWithdrawal(
        site="jahan-bastan",
        kind="visa-services",
        action="withdraw",
        id="be961690-3904-44d0-b29c-1f46f3fcb9fa",
        name="visa",
    )
    assert await withdraw_profile(session, profile) == {
        "linked": True,
        "blocked": False,
    }
    assert row.status == "archived"
    assert await withdraw_profile(session, profile) == {
        "linked": False,
        "blocked": False,
    }
    session.delete.assert_not_awaited()
