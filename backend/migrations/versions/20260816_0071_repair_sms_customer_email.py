"""Repair the internal email domain used for SMS-created customer accounts."""

import sqlalchemy as sa
from alembic import op

revision = "20260816_0071"
down_revision = "20260816_0070"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE customer_users "
            "SET email = replace(email, '@users.jahanbastan.invalid', '@jahanbastan.ir') "
            "WHERE email LIKE 'phone-%@users.jahanbastan.invalid'"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE customer_users "
            "SET email = replace(email, '@jahanbastan.ir', '@users.jahanbastan.invalid') "
            "WHERE email LIKE 'phone-%@jahanbastan.ir'"
        )
    )
