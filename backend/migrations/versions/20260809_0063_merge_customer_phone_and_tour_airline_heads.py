"""Merge customer phone and tour airline migration branches."""

from collections.abc import Sequence

revision: str = "20260809_0063"
down_revision: tuple[str, str] = ("20260809_0057", "20260809_0062")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Merge the two already-applied schema branches."""


def downgrade() -> None:
    """Split back to the two parent migration branches."""
