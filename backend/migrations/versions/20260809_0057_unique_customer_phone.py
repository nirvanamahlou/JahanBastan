"""Require unique non-empty customer phone numbers for OTP login.

Revision ID: 20260809_0057
Revises: 20260808_0056
Create Date: 2026-08-09
"""

import sqlalchemy as sa
from alembic import op

revision = "20260809_0057"
down_revision = "20260808_0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_customer_users_phone",
        "customer_users",
        ["phone"],
        unique=True,
        postgresql_where=sa.text("phone IS NOT NULL AND trim(phone) <> ''"),
    )


def downgrade() -> None:
    op.drop_index("uq_customer_users_phone", table_name="customer_users")
