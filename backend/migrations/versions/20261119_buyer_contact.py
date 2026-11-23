"""Add buyer contact fields to customer profiles."""

import sqlalchemy as sa
from alembic import op

revision = "20261119_buyer_contact"
down_revision = "20261118_0107"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customer_users", sa.Column("buyer_mobile", sa.String(32)))
    op.add_column("customer_users", sa.Column("landline", sa.String(32)))
    op.add_column("customer_users", sa.Column("postal_code", sa.String(20)))


def downgrade() -> None:
    op.drop_column("customer_users", "postal_code")
    op.drop_column("customer_users", "landline")
    op.drop_column("customer_users", "buyer_mobile")
