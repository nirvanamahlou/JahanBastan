"""Safe loading and validation of editable Dataverse entity mappings."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.config import Settings

REQUIRED_TABLE_KEYS = (
    "tour",
    "hotel",
    "tour_date",
    "tour_price",
    "ticket",
    "destination",
    "customer",
    "request",
    "order",
    "invoice",
)


class DataverseMappingError(ValueError):
    """Raised when an editable mapping file cannot be safely used."""


@dataclass(frozen=True)
class EntityMapping:
    """Logical and Web API names for one Dataverse table."""

    key: str
    logical_name: str
    entity_set_name: str
    primary_id_name: str
    columns: dict[str, str] = field(default_factory=dict)
    lookups: dict[str, str] = field(default_factory=dict)
    choices: dict[str, dict[str, int]] = field(default_factory=dict)

    @property
    def is_ready(self) -> bool:
        fields = (self.logical_name, self.entity_set_name, self.primary_id_name)
        return all(value and not value.startswith("REPLACE_") for value in fields)


@dataclass(frozen=True)
class DataverseMapping:
    """Versioned mapping contract independent from application ORM models."""

    version: int
    entities: dict[str, EntityMapping]

    def readiness(self) -> dict[str, bool]:
        return {key: self.entities[key].is_ready for key in REQUIRED_TABLE_KEYS}


def load_dataverse_mapping(path_value: str | None) -> DataverseMapping | None:
    """Load a local mapping document without ever contacting Dataverse."""
    if not path_value:
        return None
    path = Path(path_value)
    if not path.is_file():
        raise DataverseMappingError("DATAVERSE_MAPPING_FILE does not point to a file")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise DataverseMappingError("Dataverse mapping file is not valid JSON") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("entities"), dict):
        raise DataverseMappingError("Dataverse mapping must contain an entities object")

    entities: dict[str, EntityMapping] = {}
    for key, raw in payload["entities"].items():
        if not isinstance(raw, dict):
            raise DataverseMappingError(f"Entity mapping {key!r} must be an object")
        entities[key] = EntityMapping(
            key=key,
            logical_name=_string_field(raw, "logical_name", key),
            entity_set_name=_string_field(raw, "entity_set_name", key),
            primary_id_name=_string_field(raw, "primary_id_name", key),
            columns=_string_map(raw.get("columns"), key, "columns"),
            lookups=_string_map(raw.get("lookups"), key, "lookups"),
            choices=_choice_map(raw.get("choices"), key),
        )
    missing = set(REQUIRED_TABLE_KEYS).difference(entities)
    if missing:
        raise DataverseMappingError(
            "Mapping is missing required entities: " + ", ".join(sorted(missing))
        )
    version = payload.get("version", 1)
    if not isinstance(version, int) or version < 1:
        raise DataverseMappingError("Mapping version must be a positive integer")
    return DataverseMapping(version=version, entities=entities)


def configuration_gaps(settings: Settings) -> list[str]:
    """Return setting names that must be present before the connector is enabled."""
    required = {
        "DATAVERSE_ENVIRONMENT_URL": settings.DATAVERSE_ENVIRONMENT_URL,
        "DATAVERSE_ENVIRONMENT_ID": settings.DATAVERSE_ENVIRONMENT_ID,
        "DATAVERSE_TENANT_ID": settings.DATAVERSE_TENANT_ID,
        "DATAVERSE_CLIENT_ID": settings.DATAVERSE_CLIENT_ID,
        "DATAVERSE_APPLICATION_USER_ID": settings.DATAVERSE_APPLICATION_USER_ID,
        "DATAVERSE_SECURITY_ROLE": settings.DATAVERSE_SECURITY_ROLE,
        "DATAVERSE_MAPPING_FILE": settings.DATAVERSE_MAPPING_FILE,
    }
    gaps = [key for key, value in required.items() if not value]
    if (
        settings.DATAVERSE_AUTH_METHOD == "client_secret"
        and not settings.DATAVERSE_CLIENT_SECRET
    ):
        gaps.append("DATAVERSE_CLIENT_SECRET")
    if settings.DATAVERSE_AUTH_METHOD == "certificate":
        if not settings.DATAVERSE_CERTIFICATE_PATH:
            gaps.append("DATAVERSE_CERTIFICATE_PATH")
        if not settings.DATAVERSE_CERTIFICATE_THUMBPRINT:
            gaps.append("DATAVERSE_CERTIFICATE_THUMBPRINT")
    return gaps


def _string_field(raw: dict[str, Any], name: str, key: str) -> str:
    value = raw.get(name)
    if not isinstance(value, str):
        raise DataverseMappingError(f"Entity mapping {key!r} needs a string {name}")
    return value


def _string_map(value: Any, key: str, name: str) -> dict[str, str]:
    if value is None:
        return {}
    if not isinstance(value, dict) or not all(
        isinstance(map_key, str) and isinstance(map_value, str)
        for map_key, map_value in value.items()
    ):
        raise DataverseMappingError(f"Entity mapping {key!r} has invalid {name}")
    return value


def _choice_map(value: Any, key: str) -> dict[str, dict[str, int]]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise DataverseMappingError(f"Entity mapping {key!r} has invalid choices")
    result: dict[str, dict[str, int]] = {}
    for choice_name, choices in value.items():
        if not isinstance(choice_name, str) or not isinstance(choices, dict):
            raise DataverseMappingError(f"Entity mapping {key!r} has invalid choices")
        if not all(
            isinstance(name, str) and isinstance(number, int)
            for name, number in choices.items()
        ):
            raise DataverseMappingError(
                f"Entity mapping {key!r} has invalid choice values"
            )
        result[choice_name] = choices
    return result
