"""Encrypted storage and malware scanning for private customer documents."""

from __future__ import annotations

import asyncio
import struct
from pathlib import Path
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from starlette.responses import Response

from app.core.config import Settings

_ENCRYPTED_MARKER = b"JBENC1\x00"


def _cipher(settings: Settings) -> Fernet | None:
    key = settings.PRIVATE_FILE_ENCRYPTION_KEY
    if key is None:
        return None
    try:
        return Fernet(key.get_secret_value().encode("ascii"))
    except (TypeError, ValueError) as exc:
        raise RuntimeError("private file encryption key is invalid") from exc


async def scan_for_malware(content: bytes, settings: Settings) -> None:
    if not settings.CLAMAV_HOST:
        if settings.CLAMAV_REQUIRED:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "document security scanner is unavailable",
            )
        return
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(settings.CLAMAV_HOST, settings.CLAMAV_PORT),
            timeout=settings.CLAMAV_TIMEOUT_SECONDS,
        )
        writer.write(b"zINSTREAM\x00")
        for offset in range(0, len(content), 64 * 1024):
            chunk = content[offset : offset + 64 * 1024]
            writer.write(struct.pack(">I", len(chunk)))
            writer.write(chunk)
        writer.write(struct.pack(">I", 0))
        await writer.drain()
        result = await asyncio.wait_for(
            reader.read(4096), timeout=settings.CLAMAV_TIMEOUT_SECONDS
        )
        writer.close()
        await writer.wait_closed()
    except (OSError, TimeoutError):
        if settings.CLAMAV_REQUIRED:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "document security scanner is unavailable",
            ) from None
        return
    verdict = result.decode("utf-8", errors="replace")
    if "FOUND" in verdict:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "the uploaded document was rejected by the security scanner",
        )
    if "OK" not in verdict and settings.CLAMAV_REQUIRED:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "document security scanner returned an invalid response",
        )


def _resolve_private_path(storage_key: str, settings: Settings) -> Path:
    root = Path(settings.MEDIA_ROOT).resolve()
    target = (root / storage_key).resolve()
    if root not in target.parents:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    return target


async def store_private_bytes(
    storage_key: str, content: bytes, settings: Settings
) -> None:
    await scan_for_malware(content, settings)
    target = _resolve_private_path(storage_key, settings)
    cipher = _cipher(settings)
    payload = (
        _ENCRYPTED_MARKER + cipher.encrypt(content) if cipher is not None else content
    )
    await asyncio.to_thread(target.parent.mkdir, parents=True, exist_ok=True)
    await asyncio.to_thread(target.write_bytes, payload)


async def read_private_bytes(storage_key: str, settings: Settings) -> bytes:
    target = _resolve_private_path(storage_key, settings)
    if not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document file not found")
    payload = await asyncio.to_thread(target.read_bytes)
    if not payload.startswith(_ENCRYPTED_MARKER):
        return payload
    cipher = _cipher(settings)
    if cipher is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "document encryption is not configured",
        )
    try:
        return cipher.decrypt(payload[len(_ENCRYPTED_MARKER) :])
    except InvalidToken:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "document integrity verification failed",
        ) from None


async def private_download_response(
    storage_key: str,
    filename: str,
    mime_type: str,
    settings: Settings,
) -> Response:
    content = await read_private_bytes(storage_key, settings)
    safe_name = quote(filename, safe="")
    return Response(
        content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
