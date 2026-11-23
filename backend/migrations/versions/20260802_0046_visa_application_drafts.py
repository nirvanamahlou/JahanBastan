"""Keep visa applications private until the customer submits them."""

import sqlalchemy as sa
from alembic import op

revision = "20260802_0046"
down_revision = "20260802_0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "chk_visa_applications_status",
        "visa_applications",
        type_="check",
    )
    op.create_check_constraint(
        "chk_visa_applications_status",
        "visa_applications",
        "status IN ('draft', 'pending_review', 'needs_documents', 'approved', 'rejected')",
    )
    op.alter_column(
        "visa_applications",
        "status",
        existing_type=sa.String(length=32),
        server_default=sa.text("'draft'"),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE visa_applications SET status = 'pending_review' WHERE status = 'draft'"
    )
    op.drop_constraint(
        "chk_visa_applications_status",
        "visa_applications",
        type_="check",
    )
    op.create_check_constraint(
        "chk_visa_applications_status",
        "visa_applications",
        "status IN ('pending_review', 'needs_documents', 'approved', 'rejected')",
    )
    op.alter_column(
        "visa_applications",
        "status",
        existing_type=sa.String(length=32),
        server_default=sa.text("'pending_review'"),
        existing_nullable=False,
    )
