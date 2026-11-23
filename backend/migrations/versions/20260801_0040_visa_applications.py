"""Add visa types and private customer visa application workflow."""

import sqlalchemy as sa
from alembic import op

revision = "20260801_0040"
down_revision = "20260801_0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column("visa_type", sa.String(length=24), nullable=True),
    )
    op.create_table(
        "visa_applications",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("customer_user_id", sa.BigInteger(), nullable=False),
        sa.Column("travel_service_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default=sa.text("'pending_review'"),
            nullable=False,
        ),
        sa.Column("customer_message", sa.Text(), nullable=True),
        sa.Column("internal_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by_admin_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending_review', 'needs_documents', 'approved', 'rejected')",
            name="chk_visa_applications_status",
        ),
        sa.ForeignKeyConstraint(
            ["customer_user_id"], ["customer_users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["travel_service_id"], ["travel_services.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_admin_id"], ["admin_users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_visa_applications_customer_created",
        "visa_applications",
        ["customer_user_id", "created_at"],
    )
    op.create_index(
        "idx_visa_applications_status_created",
        "visa_applications",
        ["status", "created_at"],
    )
    op.create_table(
        "visa_application_documents",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("visa_application_id", sa.BigInteger(), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("byte_size > 0", name="chk_visa_application_documents_size"),
        sa.ForeignKeyConstraint(
            ["visa_application_id"], ["visa_applications.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "storage_key", name="uq_visa_application_documents_storage_key"
        ),
    )
    op.create_index(
        "idx_visa_application_documents_application",
        "visa_application_documents",
        ["visa_application_id", "id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_visa_application_documents_application",
        table_name="visa_application_documents",
    )
    op.drop_table("visa_application_documents")
    op.drop_index(
        "idx_visa_applications_status_created", table_name="visa_applications"
    )
    op.drop_index(
        "idx_visa_applications_customer_created", table_name="visa_applications"
    )
    op.drop_table("visa_applications")
    op.drop_column("travel_services", "visa_type")
