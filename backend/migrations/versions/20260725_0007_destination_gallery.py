"""Add bounded destination image galleries.

Revision ID: 20260725_0007
Revises: 20260723_0006
Create Date: 2026-07-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260725_0007"
down_revision: str | None = "20260723_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "destination_images",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "destination_id",
            sa.BigInteger(),
            sa.ForeignKey("destinations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "image_id",
            sa.BigInteger(),
            sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "display_order BETWEEN 0 AND 5",
            name="chk_destination_images_display_order",
        ),
        sa.UniqueConstraint(
            "destination_id",
            "image_id",
            name="uq_destination_images_image",
        ),
        sa.UniqueConstraint(
            "destination_id",
            "display_order",
            name="uq_destination_images_order",
        ),
    )


def downgrade() -> None:
    op.drop_table("destination_images")
