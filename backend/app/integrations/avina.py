"""Authenticated server-only client for Avina's site-commerce boundary."""

import asyncio
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from app.core.config import get_settings


class AvinaError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool, status: int = 502):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.status = status


class AvinaClient:
    """Keep credentials and Nora cookies on the server and out of logs."""

    site = "jahan-bastan"

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._url = str(settings.AVINA_ERP_API_URL or "").rstrip("/")
        self._username = (
            settings.AVINA_ERP_USERNAME.get_secret_value()
            if settings.AVINA_ERP_USERNAME
            else ""
        )
        self._password = (
            settings.AVINA_ERP_PASSWORD.get_secret_value()
            if settings.AVINA_ERP_PASSWORD
            else ""
        )
        self._client = client or httpx.AsyncClient(
            timeout=settings.AVINA_ERP_TIMEOUT_SECONDS,
            follow_redirects=False,
            headers={"Accept": "application/json", "x-nora-site-commerce": "1"},
        )
        self._login_lock = asyncio.Lock()

    @property
    def configured(self) -> bool:
        return bool(self._url and self._username and self._password)

    async def _login(self) -> None:
        if not self.configured:
            raise AvinaError(
                "erp_not_configured",
                "اتصال ERP برای ثبت پیش‌نویس تنظیم نشده است.",
                retryable=False,
                status=503,
            )
        async with self._login_lock:
            try:
                response = await self._client.post(
                    f"{self._url}/iam/auth/login",
                    json={"username": self._username, "password": self._password},
                )
            except httpx.TimeoutException as error:
                raise AvinaError(
                    "erp_timeout", "ERP پاسخ نداد.", retryable=True
                ) from error
            except httpx.HTTPError as error:
                raise AvinaError(
                    "erp_unavailable", "ارتباط با ERP برقرار نشد.", retryable=True
                ) from error
            if response.status_code >= 400:
                raise AvinaError(
                    "erp_authentication_failed",
                    "احراز هویت ERP ناموفق بود.",
                    retryable=response.status_code >= 500,
                    status=503,
                )

    async def request(
        self, method: str, path: str, *, payload: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        if not self.configured:
            await self._login()
        url = f"{self._url}/sales/site-commerce/v1/{self.site}/{path.lstrip('/')}"
        for attempt in range(2):
            if not self._client.cookies.get("nora_access"):
                await self._login()
            try:
                response = await self._client.request(method, url, json=payload)
            except httpx.TimeoutException as error:
                raise AvinaError(
                    "erp_timeout", "ERP پاسخ نداد.", retryable=True
                ) from error
            except httpx.HTTPError as error:
                raise AvinaError(
                    "erp_unavailable", "ارتباط با ERP برقرار نشد.", retryable=True
                ) from error
            if response.status_code == 401 and attempt == 0:
                self._client.cookies.delete("nora_access")
                continue
            if response.status_code >= 400:
                retryable = response.status_code >= 500 or response.status_code == 429
                code = "erp_conflict" if response.status_code == 409 else "erp_rejected"
                raise AvinaError(
                    code,
                    "ERP درخواست ثبت پیش‌نویس را نپذیرفت.",
                    retryable=retryable,
                    status=503 if retryable else response.status_code,
                )
            try:
                value = response.json()
            except ValueError as error:
                raise AvinaError(
                    "erp_invalid_response", "پاسخ ERP معتبر نبود.", retryable=True
                ) from error
            if not isinstance(value, dict):
                raise AvinaError(
                    "erp_invalid_response", "پاسخ ERP معتبر نبود.", retryable=True
                )
            return value
        raise AvinaError(
            "erp_authentication_failed", "احراز هویت ERP ناموفق بود.", retryable=False
        )

    async def quote(
        self, product_ids: list[str], birth_dates: list[str]
    ) -> list[dict[str, Any]]:
        response = await self.request(
            "POST",
            "flight-quote",
            payload={"productIds": product_ids, "birthDates": birth_dates},
        )
        data = response.get("data")
        if not isinstance(data, list) or len(data) != len(product_ids):
            raise AvinaError("erp_invalid_quote", "نرخ ERP معتبر نبود.", retryable=True)
        try:
            valid = all(
                isinstance(item, dict)
                and Decimal(str(item.get("amount"))).is_finite()
                and Decimal(str(item.get("amount"))) >= 0
                and bool(re.fullmatch(r"[A-Z]{3}", str(item.get("currencyCode"))))
                for item in data
            )
        except (InvalidOperation, TypeError, ValueError):
            valid = False
        if not valid:
            raise AvinaError("erp_invalid_quote", "نرخ ERP معتبر نبود.", retryable=True)
        return data

    async def buyer(self, external_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("POST", f"buyers/{external_id}", payload=payload)

    async def person(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("POST", "people", payload=payload)

    async def check_people(
        self, passengers: list[dict[str, Any]]
    ) -> list[dict[str, Any]] | None:
        try:
            result = await self.request(
                "POST", "people/check", payload={"passengers": passengers}
            )
        except AvinaError as error:
            if error.status == 404:
                # Older Avina builds support drafts but lack the read-only identity API.
                return None
            raise
        items = result.get("data")
        if (
            not isinstance(items, list)
            or len(items) != len(passengers)
            or any(
                not isinstance(item, dict)
                or type(item.get("index")) is not int
                or item["index"] != index
                or type(item.get("valid")) is not bool
                for index, item in enumerate(items)
            )
        ):
            raise AvinaError(
                "erp_invalid_identity_check",
                "پاسخ بررسی هویت آوینا معتبر نبود.",
                retryable=True,
            )
        return items

    async def draft(self, external_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("POST", f"orders/{external_id}", payload=payload)

    async def status(self, external_id: str) -> dict[str, Any]:
        return await self.request("GET", f"orders/{external_id}")


avina_client = AvinaClient()
