"""Assign stable Excel identifiers to hotels created manually."""

import sqlalchemy as sa
from alembic import op

revision = "20260728_0026"
down_revision = "20260728_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE hotels
        SET hotel_code = 'HTL-' || LPAD(id::text, 6, '0')
        WHERE hotel_code IS NULL
        """
    )
    op.alter_column("hotels", "hotel_code", existing_type=sa.String(64), nullable=False)


def downgrade() -> None:
    op.alter_column("hotels", "hotel_code", existing_type=sa.String(64), nullable=True)
