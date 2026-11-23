"""Add structured visa document requirements and typed uploads."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260801_0044"
down_revision = "20260801_0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column(
            "visa_document_requirements",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "visa_application_documents",
        sa.Column(
            "document_type",
            sa.String(length=120),
            server_default=sa.text("'مدرک تکمیلی'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("visa_application_documents", "document_type")
    op.drop_column("travel_services", "visa_document_requirements")
