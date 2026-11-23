"""Add the editorial hotels catalogue.

Revision ID: 20260723_0003
Revises: 20260723_0002
Create Date: 2026-07-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260723_0003"
down_revision: str | None = "20260723_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create hotels and indexes used by public catalogue queries."""
    op.create_table(
        "hotels",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("destination_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("star_rating", sa.SmallInteger(), nullable=False),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("address", sa.String(300)),
        sa.Column("image_id", sa.BigInteger()),
        sa.Column(
            "status",
            postgresql.ENUM(
                "draft",
                "published",
                "archived",
                name="publication_status",
                create_type=False,
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column(
            "is_featured",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "star_rating BETWEEN 1 AND 5",
            name="chk_hotels_star_rating",
        ),
        sa.CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_hotels_publication_time",
        ),
        sa.ForeignKeyConstraint(
            ["destination_id"], ["destinations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "idx_hotels_destination_published",
        "hotels",
        ["destination_id", "star_rating"],
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index(
        "idx_hotels_featured",
        "hotels",
        [sa.text("published_at DESC")],
        postgresql_where=sa.text("status = 'published' AND is_featured = true"),
    )


def downgrade() -> None:
    """Remove the hotels catalogue."""
    op.drop_table("hotels")
