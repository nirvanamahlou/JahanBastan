"""Secure WebP image optimization with a future S3-compatible boundary."""

import asyncio
import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
WEBP_MIME_TYPE = "image/webp"
WEBP_EXTENSION = ".webp"


def optimize_image_to_webp(
    content: bytes,
    *,
    max_dimension: int,
    quality: int,
    max_pixels: int,
) -> tuple[bytes, int, int]:
    """Decode, orient, bound, and encode one image as metadata-free WebP."""
    if not content:
        raise HTTPException(415, "invalid image file")

    try:
        with Image.open(io.BytesIO(content)) as source:
            image_format = source.format or ""
            if image_format not in ALLOWED_FORMATS:
                raise HTTPException(415, "only JPEG, PNG, and WebP are allowed")
            if source.width * source.height > max_pixels:
                raise HTTPException(413, "image dimensions are too large")

            source.load()
            image = ImageOps.exif_transpose(source)
            image.thumbnail(
                (max_dimension, max_dimension),
                Image.Resampling.LANCZOS,
                reducing_gap=3.0,
            )
            if image.mode not in {"RGB", "RGBA"}:
                has_alpha = image.mode == "LA" or (
                    image.mode == "P" and "transparency" in image.info
                )
                image = image.convert("RGBA" if has_alpha else "RGB")

            output = io.BytesIO()
            image.save(
                output,
                format="WEBP",
                quality=quality,
                method=6,
                exact=False,
            )
            optimized = output.getvalue()
            return optimized, image.width, image.height
    except HTTPException:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise HTTPException(415, "invalid image file") from exc


async def store_image(upload: UploadFile) -> tuple[str, str, int, int, int]:
    """Validate, optimize, and persist an upload without blocking the event loop."""
    settings = get_settings()
    content = await upload.read(settings.MEDIA_MAX_BYTES + 1)
    if len(content) > settings.MEDIA_MAX_BYTES:
        raise HTTPException(413, "image exceeds configured upload limit")

    optimized, width, height = await asyncio.to_thread(
        optimize_image_to_webp,
        content,
        max_dimension=settings.MEDIA_MAX_DIMENSION,
        quality=settings.MEDIA_WEBP_QUALITY,
        max_pixels=settings.MEDIA_MAX_PIXELS,
    )
    storage_key = f"{uuid.uuid4().hex}{WEBP_EXTENSION}"
    target = Path(settings.MEDIA_ROOT) / storage_key
    await asyncio.to_thread(target.parent.mkdir, parents=True, exist_ok=True)
    await asyncio.to_thread(target.write_bytes, optimized)
    return storage_key, WEBP_MIME_TYPE, len(optimized), width, height
