"""Content-based validation for untrusted document and workbook uploads."""

from __future__ import annotations

from io import BytesIO
from pathlib import PurePosixPath
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

EXPECTED_IMAGE_FORMATS = {
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
}


def validate_document_bytes(content: bytes, extension: str) -> None:
    """Validate bytes rather than trusting a browser-provided MIME type."""
    normalized = extension.casefold().lstrip(".")
    if normalized == "pdf":
        if not content.startswith(b"%PDF-") or b"%%EOF" not in content[-2048:]:
            raise HTTPException(415, "The uploaded PDF structure is invalid.")
        return

    expected_format = EXPECTED_IMAGE_FORMATS.get(normalized)
    if expected_format is None:
        raise HTTPException(415, "Unsupported document format.")
    try:
        with Image.open(BytesIO(content)) as image:
            if image.format != expected_format:
                raise HTTPException(415, "The image content does not match its type.")
            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(415, "The uploaded image structure is invalid.") from exc


def validate_xlsx_archive(content: bytes) -> None:
    """Reject malformed, encrypted, traversing, or highly expanded XLSX archives."""
    try:
        with ZipFile(BytesIO(content)) as archive:
            entries = archive.infolist()
            names = {entry.filename for entry in entries}
            if len(entries) > 500:
                raise HTTPException(
                    422, "The workbook contains too many archive entries."
                )
            if not {"[Content_Types].xml", "xl/workbook.xml"}.issubset(names):
                raise HTTPException(
                    422, "The uploaded file is not a valid .xlsx workbook."
                )

            expanded_size = 0
            for entry in entries:
                path = PurePosixPath(entry.filename)
                if path.is_absolute() or ".." in path.parts or entry.flag_bits & 0x1:
                    raise HTTPException(422, "The workbook archive is unsafe.")
                expanded_size += entry.file_size
                if expanded_size > 50 * 1024 * 1024:
                    raise HTTPException(
                        422, "The workbook expands beyond the safe limit."
                    )
                if entry.file_size > 1024 * 1024 and entry.compress_size:
                    if entry.file_size / entry.compress_size > 200:
                        raise HTTPException(
                            422, "The workbook compression ratio is unsafe."
                        )
    except HTTPException:
        raise
    except (BadZipFile, OSError) as exc:
        raise HTTPException(
            422, "The uploaded file is not a valid .xlsx workbook."
        ) from exc
