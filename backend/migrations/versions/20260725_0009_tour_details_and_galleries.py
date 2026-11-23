"""Add tour detail content, six-image galleries, and merge Turkey aliases.

Revision ID: 20260725_0009
Revises: 20260725_0008
"""

import sqlalchemy as sa
from alembic import op

revision = "20260725_0009"
down_revision = "20260725_0008"
branch_labels = None
depends_on = None


def _gallery_table(name: str, owner_table: str, owner_column: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column(owner_column, sa.BigInteger(), nullable=False),
        sa.Column("image_id", sa.BigInteger(), nullable=False),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("display_order BETWEEN 0 AND 5", name=f"chk_{name}_order"),
        sa.ForeignKeyConstraint(
            [owner_column], [f"{owner_table}.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["image_id"], ["media_assets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(owner_column, "image_id", name=f"uq_{name}_image"),
        sa.UniqueConstraint(owner_column, "display_order", name=f"uq_{name}_order"),
    )


def upgrade() -> None:
    op.add_column("crm_tour_cache", sa.Column("itinerary", sa.Text()))
    op.add_column("crm_tour_cache", sa.Column("included_services", sa.Text()))
    op.add_column("crm_tour_cache", sa.Column("excluded_services", sa.Text()))
    _gallery_table("country_images", "countries", "country_id")
    _gallery_table("hotel_images", "hotels", "hotel_id")
    _gallery_table("article_images", "articles", "article_id")
    _gallery_table("travel_service_images", "travel_services", "service_id")

    # Preserve a Persian canonical row, merge useful metadata, then remove aliases.
    op.execute(
        """
        DO $$
        DECLARE canonical_id bigint;
        BEGIN
          SELECT id INTO canonical_id
          FROM countries
          WHERE lower(trim(name)) = 'turkey'
             OR translate(trim(name), 'يك', 'یک') = 'ترکیه'
          ORDER BY
            CASE
              WHEN trim(name) = 'ترکیه' THEN 0
              WHEN translate(trim(name), 'يك', 'یک') = 'ترکیه' THEN 1
              ELSE 2
            END,
            id
          LIMIT 1;

          IF canonical_id IS NOT NULL THEN
            UPDATE countries c SET
              name = 'ترکیه',
              image_id = COALESCE(
                c.image_id,
                (SELECT image_id FROM countries
                 WHERE id <> canonical_id
                   AND (lower(trim(name)) = 'turkey'
                     OR translate(trim(name), 'يك', 'یک') = 'ترکیه')
                   AND image_id IS NOT NULL
                 ORDER BY id LIMIT 1)
              ),
              updated_at = now()
            WHERE c.id = canonical_id;

            DELETE FROM countries
            WHERE id <> canonical_id
              AND (lower(trim(name)) = 'turkey'
                OR translate(trim(name), 'يك', 'یک') = 'ترکیه');
          END IF;
        END $$;

        UPDATE destinations
        SET country = 'ترکیه', updated_at = now()
        WHERE lower(trim(country)) = 'turkey'
           OR translate(trim(country), 'يك', 'یک') = 'ترکیه';
        """
    )


def downgrade() -> None:
    op.drop_table("travel_service_images")
    op.drop_table("article_images")
    op.drop_table("hotel_images")
    op.drop_table("country_images")
    op.drop_column("crm_tour_cache", "excluded_services")
    op.drop_column("crm_tour_cache", "included_services")
    op.drop_column("crm_tour_cache", "itinerary")
