import asyncio
import base64
import binascii
import hashlib
import os
from pathlib import Path
from typing import NamedTuple
from urllib.parse import urljoin, urlsplit

import httpx
from fastapi import HTTPException

from app.core.config import get_settings
from app.services.media import optimize_image_to_webp


class PreparedImage(NamedTuple):
    key: str
    size: int
    width: int
    height: int


async def prepare_image(content: bytes) -> PreparedImage:
    settings = get_settings()
    optimized, width, height = await asyncio.to_thread(
        optimize_image_to_webp,
        content,
        max_dimension=settings.MEDIA_MAX_DIMENSION,
        quality=settings.MEDIA_WEBP_QUALITY,
        max_pixels=settings.MEDIA_MAX_PIXELS,
    )
    key = hashlib.sha256(optimized).hexdigest() + ".webp"
    path = Path(settings.MEDIA_ROOT) / key

    def save() -> None:
        from tempfile import NamedTemporaryFile

        with NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
            temp_path = Path(temporary.name)
            try:
                temporary.write(optimized)
                temporary.close()
                temp_path.chmod(0o644)
                temp_path.replace(path)
            finally:
                temp_path.unlink(missing_ok=True)

    await asyncio.to_thread(save)
    return PreparedImage(key, len(optimized), width, height)


async def prepare_flag(flag: str | None) -> PreparedImage | None:
    if not flag:
        return None
    try:
        return await prepare_image(base64.b64decode(flag, validate=True))
    except binascii.Error as exc:
        raise HTTPException(422, "تصویر پرچم معتبر نیست.") from exc


async def prepare_hotel_images(
    main: str | None, gallery: str | None
) -> tuple[PreparedImage | None, list[PreparedImage]]:
    return await prepare_profile_images(
        main,
        (gallery or "").split("|"),
        subject="هتل",
    )


async def prepare_profile_images(
    main: str | None, gallery: list[str], *, subject: str
) -> tuple[PreparedImage | None, list[PreparedImage]]:
    items = list(dict.fromkeys(item.strip() for item in gallery if item.strip()))
    if len(items) > 6:
        raise HTTPException(422, f"گالری {subject} حداکثر شش تصویر می‌پذیرد.")
    hosts = {
        "avinaofficial.ir",
        "niyayeshseir.com",
        "niyayeshseir.ir",
        *os.getenv("AVINA_HOTEL_IMAGE_HOSTS", "").lower().split(","),
    }

    async def fetch(client: httpx.AsyncClient, source: str) -> PreparedImage:
        url = urljoin("https://avinaofficial.ir", source)
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc.lower() not in hosts:
            raise HTTPException(
                422,
                "تصویر هتل را در آوینا بارگذاری کنید یا از میزبان مجاز استفاده کنید.",
            )
        limit = get_settings().MEDIA_MAX_BYTES
        try:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    data.extend(chunk)
                    if len(data) > limit:
                        raise HTTPException(413, "حجم تصویر هتل بیش از حد مجاز است.")
            return await prepare_image(bytes(data))
        except httpx.HTTPError as exc:
            raise HTTPException(422, "دریافت یکی از تصاویر هتل انجام نشد.") from exc

    if not main and not items:
        return None, []
    async with httpx.AsyncClient(
        timeout=10, follow_redirects=False, trust_env=False
    ) as client:
        async with asyncio.timeout(40):
            results = await asyncio.gather(
                *(fetch(client, source) for source in ([main] if main else []) + items),
                return_exceptions=True,
            )
        for result in results:
            if isinstance(result, BaseException):
                raise result
    return (results[0] if main else None), list(
        dict.fromkeys(results[1:] if main else results)
    )
