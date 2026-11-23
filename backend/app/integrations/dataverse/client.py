"""Opt-in, read-only Dataverse Web API client.

No request is issued while DATAVERSE_ENABLED is false. Writes are intentionally
not implemented; request/order writes need a separately approved CRM contract.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

from app.core.config import Settings
from app.integrations.dataverse.mapping import (
    DataverseMapping,
    DataverseMappingError,
    configuration_gaps,
)


class DataverseConfigurationError(RuntimeError):
    """Raised before a connection when required configuration is incomplete."""


class DataverseClient:
    """A narrow client that can read mapped Dataverse entity collections."""

    def __init__(self, settings: Settings, mapping: DataverseMapping) -> None:
        self._settings = settings
        self._mapping = mapping
        self._token: str | None = None
        self._token_expires_at = 0.0
        self._token_lock = asyncio.Lock()

    async def list_rows(
        self,
        entity_key: str,
        *,
        select: tuple[str, ...] = (),
        top: int = 100,
    ) -> list[dict[str, Any]]:
        """Read a bounded collection using mapped entity-set and column names."""
        self._ensure_enabled()
        if not 1 <= top <= 1_000:
            raise ValueError("top must be between 1 and 1000")
        entity = self._mapping.entities.get(entity_key)
        if entity is None or not entity.is_ready:
            raise DataverseConfigurationError(
                f"Entity mapping is incomplete: {entity_key}"
            )
        params: dict[str, str | int] = {"$top": top}
        if select:
            params["$select"] = ",".join(select)
        response = await self._request(
            "GET",
            f"api/data/{self._settings.DATAVERSE_API_VERSION}/{entity.entity_set_name}",
            params=params,
        )
        payload = response.json()
        values = payload.get("value", [])
        if not isinstance(values, list):
            raise RuntimeError("Dataverse returned an invalid collection payload")
        return [row for row in values if isinstance(row, dict)]

    def _ensure_enabled(self) -> None:
        if not self._settings.DATAVERSE_ENABLED:
            raise DataverseConfigurationError("Dataverse integration is disabled")
        gaps = configuration_gaps(self._settings)
        if gaps:
            raise DataverseConfigurationError(
                "Dataverse configuration is incomplete: " + ", ".join(gaps)
            )
        if self._settings.DATAVERSE_AUTH_METHOD == "certificate":
            raise DataverseConfigurationError(
                "Certificate authentication awaits an approved certificate adapter"
            )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str | int] | None = None,
    ) -> httpx.Response:
        token = await self._get_access_token()
        base_url = str(self._settings.DATAVERSE_ENVIRONMENT_URL).rstrip("/")
        timeout = httpx.Timeout(
            connect=self._settings.DATAVERSE_CONNECT_TIMEOUT_SECONDS,
            read=self._settings.DATAVERSE_READ_TIMEOUT_SECONDS,
            write=self._settings.DATAVERSE_READ_TIMEOUT_SECONDS,
            pool=self._settings.DATAVERSE_CONNECT_TIMEOUT_SECONDS,
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            for attempt in range(self._settings.DATAVERSE_MAX_RETRIES + 1):
                response = await client.request(
                    method,
                    f"{base_url}/{path.lstrip('/')}",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/json",
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0",
                    },
                    params=params,
                )
                if response.status_code not in {429, 500, 502, 503, 504}:
                    response.raise_for_status()
                    return response
                if attempt == self._settings.DATAVERSE_MAX_RETRIES:
                    response.raise_for_status()
                await asyncio.sleep(min(0.25 * (2**attempt), 2.0))
        raise RuntimeError("Dataverse request retry loop ended unexpectedly")

    async def _get_access_token(self) -> str:
        if self._token and time.monotonic() < self._token_expires_at:
            return self._token
        async with self._token_lock:
            if self._token and time.monotonic() < self._token_expires_at:
                return self._token
            token_url = (
                f"https://login.microsoftonline.com/{self._settings.DATAVERSE_TENANT_ID}"
                "/oauth2/v2.0/token"
            )
            scope = (
                f"{str(self._settings.DATAVERSE_ENVIRONMENT_URL).rstrip('/')}/.default"
            )
            client_secret = self._settings.DATAVERSE_CLIENT_SECRET
            if client_secret is None:
                raise DataverseConfigurationError("DATAVERSE_CLIENT_SECRET is missing")
            async with httpx.AsyncClient(
                timeout=self._settings.DATAVERSE_CONNECT_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    token_url,
                    data={
                        "client_id": self._settings.DATAVERSE_CLIENT_ID,
                        "client_secret": client_secret.get_secret_value(),
                        "grant_type": "client_credentials",
                        "scope": scope,
                    },
                )
            response.raise_for_status()
            payload = response.json()
            access_token = payload.get("access_token")
            expires_in = payload.get("expires_in", 3_300)
            if not isinstance(access_token, str) or not isinstance(expires_in, int):
                raise DataverseMappingError("Dataverse token response is invalid")
            self._token = access_token
            self._token_expires_at = time.monotonic() + max(expires_in - 60, 60)
            return access_token
