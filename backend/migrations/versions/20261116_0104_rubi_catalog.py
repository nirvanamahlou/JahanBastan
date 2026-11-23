"""Persist the most recent authenticated Rubi snapshot."""

from alembic import op

revision = "20261116_0104"
down_revision = "20261107_0103"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE rubi_catalog_receipt (
            site TEXT PRIMARY KEY CHECK (site = 'jahan-bastan'),
            revision BIGINT NOT NULL CHECK (revision > 0),
            snapshot JSONB NOT NULL,
            received_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    op.drop_table("rubi_catalog_receipt")
