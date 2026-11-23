"""Microsoft Dynamics 365 / Dataverse integration boundary."""

from app.integrations.dataverse.client import DataverseClient
from app.integrations.dataverse.mapping import load_dataverse_mapping

__all__ = ["DataverseClient", "load_dataverse_mapping"]
