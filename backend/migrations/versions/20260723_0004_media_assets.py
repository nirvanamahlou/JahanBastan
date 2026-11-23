"""Add validated media asset metadata.

Revision ID: 20260723_0004
Revises: 20260723_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260723_0004"
down_revision: str | None = "20260723_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("storage_key", sa.String(500), nullable=False, unique=True),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("alt_text", sa.String(255), server_default="", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("byte_size > 0", name="chk_media_assets_size"),
    )
    op.create_foreign_key(
        "fk_destinations_image",
        "destinations",
        "media_assets",
        ["image_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_hotels_image",
        "hotels",
        "media_assets",
        ["image_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_hotels_image", "hotels", type_="foreignkey")
    op.drop_constraint("fk_destinations_image", "destinations", type_="foreignkey")
    op.drop_table("media_assets")
