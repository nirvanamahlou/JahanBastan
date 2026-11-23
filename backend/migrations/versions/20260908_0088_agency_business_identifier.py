"""Allow either agency national ID or economic code.

Revision ID: 20260908_0088
Revises: 20260907_0087
Create Date: 2026-09-08
"""

import sqlalchemy as sa
from alembic import op

revision = "20260908_0088"
down_revision = "20260907_0087"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "agency_profiles",
        "national_id",
        existing_type=sa.String(length=32),
        nullable=True,
    )
    op.create_check_constraint(
        "chk_agency_profiles_business_identifier",
        "agency_profiles",
        "national_id IS NOT NULL OR economic_code IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_agency_profiles_business_identifier",
        "agency_profiles",
        type_="check",
    )
    op.execute(
        "UPDATE agency_profiles SET national_id = economic_code "
        "WHERE national_id IS NULL"
    )
    op.alter_column(
        "agency_profiles",
        "national_id",
        existing_type=sa.String(length=32),
        nullable=False,
    )
