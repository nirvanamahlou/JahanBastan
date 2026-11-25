from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.routes.erp_checkout import avina_client, check_erp_flight_capacity
from app.integrations.avina import AvinaError
from app.schemas.erp_checkout import ErpFlightCapacityCheck


@pytest.mark.parametrize("status", [None, 409, 503])
async def test_capacity_quotes_both_legs_before_registration(monkeypatch, status):
    payload = ErpFlightCapacityCheck.model_validate(
        {
            "productIds": ["outbound", "return"],
            "birthDates": ["1990-01-01", "2020-01-01", "2026-01-01"],
        }
    )
    quote = AsyncMock()
    monkeypatch.setattr(avina_client, "quote", quote)
    if status:
        quote.side_effect = AvinaError(
            "erp_error", "quote unavailable", status=status, retryable=status == 503
        )
        with pytest.raises(HTTPException) as exc:
            await check_erp_flight_capacity(payload, None, None)
        assert exc.value.status_code == status
    else:
        response = await check_erp_flight_capacity(payload, None, None)
        assert response.status_code == 204
        assert "no-store" in response.headers["cache-control"]
    quote.assert_awaited_once_with(
        ["outbound", "return"], ["1990-01-01", "2020-01-01", "2026-01-01"]
    )
