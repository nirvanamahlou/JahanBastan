"""Add checkout, private documents, installment schedules, and audit trail."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260808_0055"
down_revision = "20260808_0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking_requests",
        sa.Column(
            "payment_method", sa.String(16), server_default="cash", nullable=False
        ),
    )
    op.add_column(
        "booking_requests",
        sa.Column(
            "checkout_step", sa.String(32), server_default="review", nullable=False
        ),
    )
    op.add_column("booking_requests", sa.Column("terms_version", sa.String(40)))
    op.add_column(
        "booking_requests", sa.Column("terms_accepted_at", sa.DateTime(timezone=True))
    )
    op.add_column("booking_requests", sa.Column("subtotal_amount", sa.Numeric(14, 0)))
    for name in ("discount_amount", "tax_amount", "service_fee_amount"):
        op.add_column(
            "booking_requests",
            sa.Column(name, sa.Numeric(14, 0), server_default="0", nullable=False),
        )
    op.add_column(
        "booking_requests", sa.Column("payable_now_amount", sa.Numeric(14, 0))
    )
    op.add_column(
        "booking_requests", sa.Column("installment_months", sa.SmallInteger())
    )
    op.add_column(
        "booking_requests", sa.Column("installment_down_payment", sa.Numeric(14, 0))
    )
    op.add_column(
        "booking_requests", sa.Column("installment_fee_rate", sa.Numeric(6, 2))
    )
    op.add_column(
        "booking_requests", sa.Column("installment_financed_amount", sa.Numeric(14, 0))
    )
    op.add_column(
        "booking_requests", sa.Column("installment_total_amount", sa.Numeric(14, 0))
    )
    op.add_column(
        "booking_requests", sa.Column("installment_monthly_amount", sa.Numeric(14, 0))
    )
    op.add_column(
        "booking_requests", sa.Column("installment_first_due_date", sa.Date())
    )
    op.add_column("booking_requests", sa.Column("installment_status", sa.String(32)))
    op.add_column(
        "booking_requests",
        sa.Column(
            "guarantor_details",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "chk_booking_requests_payment_method",
        "booking_requests",
        "payment_method IN ('cash', 'installment')",
    )

    op.create_table(
        "booking_document_requirements",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("category", sa.String(24), nullable=False),
        sa.Column("applies_to", sa.String(24), nullable=False),
        sa.Column(
            "is_required", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "allowed_extensions",
            postgresql.JSONB(),
            server_default=sa.text('\'["pdf", "jpg", "jpeg", "png"]\'::jsonb'),
            nullable=False,
        ),
        sa.Column(
            "max_bytes", sa.BigInteger(), server_default="8388608", nullable=False
        ),
        sa.Column(
            "display_order", sa.SmallInteger(), server_default="0", nullable=False
        ),
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
            "category IN ('identity', 'travel', 'visa', 'installment', 'payment', 'other')",
            name="chk_booking_document_requirements_category",
        ),
        sa.CheckConstraint(
            "applies_to IN ('all', 'tour', 'flight', 'train', 'bus', 'installment')",
            name="chk_booking_document_requirements_applies_to",
        ),
        sa.CheckConstraint(
            "max_bytes > 0", name="chk_booking_document_requirements_size"
        ),
    )
    op.create_index(
        "idx_booking_document_requirements_active",
        "booking_document_requirements",
        ["applies_to", "display_order"],
        postgresql_where=sa.text("is_active = true"),
    )

    op.create_table(
        "booking_documents",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "booking_id",
            sa.BigInteger(),
            sa.ForeignKey("booking_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "requirement_id",
            sa.BigInteger(),
            sa.ForeignKey("booking_document_requirements.id", ondelete="SET NULL"),
        ),
        sa.Column("passenger_index", sa.SmallInteger()),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("review_note", sa.String(500)),
        sa.Column(
            "reviewed_by_admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
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
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_booking_documents_status",
        ),
        sa.CheckConstraint("byte_size > 0", name="chk_booking_documents_size"),
    )
    op.create_index(
        "idx_booking_documents_booking",
        "booking_documents",
        ["booking_id", "created_at"],
    )
    op.create_index(
        "idx_booking_documents_review", "booking_documents", ["status", "created_at"]
    )

    op.create_table(
        "booking_installments",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "booking_id",
            sa.BigInteger(),
            sa.ForeignKey("booking_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence", sa.SmallInteger(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 0), nullable=False),
        sa.Column("paid_amount", sa.Numeric(14, 0), server_default="0", nullable=False),
        sa.Column("status", sa.String(16), server_default="upcoming", nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("payment_reference", sa.String(160)),
        sa.Column("admin_note", sa.String(500)),
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
        sa.UniqueConstraint(
            "booking_id", "sequence", name="uq_booking_installments_sequence"
        ),
        sa.CheckConstraint("sequence > 0", name="chk_booking_installments_sequence"),
        sa.CheckConstraint("amount > 0", name="chk_booking_installments_amount"),
        sa.CheckConstraint(
            "status IN ('upcoming', 'due', 'paid', 'partial', 'overdue', 'waived', 'rescheduled')",
            name="chk_booking_installments_status",
        ),
    )
    op.create_index(
        "idx_booking_installments_due", "booking_installments", ["status", "due_date"]
    )

    op.create_table(
        "booking_status_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "booking_id",
            sa.BigInteger(),
            sa.ForeignKey("booking_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("actor_type", sa.String(16), nullable=False),
        sa.Column("actor_id", sa.BigInteger()),
        sa.Column("event_type", sa.String(48), nullable=False),
        sa.Column("from_status", sa.String(32)),
        sa.Column("to_status", sa.String(32)),
        sa.Column("note", sa.String(500)),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_booking_status_events_booking",
        "booking_status_events",
        ["booking_id", "created_at"],
    )

    requirements = sa.table(
        "booking_document_requirements",
        sa.column("title", sa.String()),
        sa.column("description", sa.String()),
        sa.column("category", sa.String()),
        sa.column("applies_to", sa.String()),
        sa.column("is_required", sa.Boolean()),
        sa.column("display_order", sa.Integer()),
    )
    op.bulk_insert(
        requirements,
        [
            {
                "title": "تصویر کارت ملی",
                "description": "رو و پشت کارت ملی در یک فایل",
                "category": "identity",
                "applies_to": "all",
                "is_required": True,
                "display_order": 10,
            },
            {
                "title": "تصویر گذرنامه",
                "description": "صفحه اول گذرنامه معتبر برای سفر خارجی",
                "category": "travel",
                "applies_to": "tour",
                "is_required": False,
                "display_order": 20,
            },
            {
                "title": "مدرک محل سکونت",
                "description": "قبض یا اجاره‌نامه معتبر",
                "category": "installment",
                "applies_to": "installment",
                "is_required": True,
                "display_order": 30,
            },
            {
                "title": "فیش حقوقی یا گواهی اشتغال",
                "description": "برای بررسی اعتبار خرید اقساطی",
                "category": "installment",
                "applies_to": "installment",
                "is_required": True,
                "display_order": 40,
            },
            {
                "title": "تصویر چک ضمانت",
                "description": "چک صیادی مطابق برنامه اقساط",
                "category": "installment",
                "applies_to": "installment",
                "is_required": True,
                "display_order": 50,
            },
            {
                "title": "رسید پرداخت",
                "description": "برای واریز بانکی یا کارت‌به‌کارت",
                "category": "payment",
                "applies_to": "all",
                "is_required": False,
                "display_order": 60,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_booking_status_events_booking", table_name="booking_status_events"
    )
    op.drop_table("booking_status_events")
    op.drop_index("idx_booking_installments_due", table_name="booking_installments")
    op.drop_table("booking_installments")
    op.drop_index("idx_booking_documents_review", table_name="booking_documents")
    op.drop_index("idx_booking_documents_booking", table_name="booking_documents")
    op.drop_table("booking_documents")
    op.drop_index(
        "idx_booking_document_requirements_active",
        table_name="booking_document_requirements",
    )
    op.drop_table("booking_document_requirements")
    op.drop_constraint(
        "chk_booking_requests_payment_method", "booking_requests", type_="check"
    )
    for name in (
        "guarantor_details",
        "installment_status",
        "installment_first_due_date",
        "installment_monthly_amount",
        "installment_total_amount",
        "installment_financed_amount",
        "installment_fee_rate",
        "installment_down_payment",
        "installment_months",
        "payable_now_amount",
        "service_fee_amount",
        "tax_amount",
        "discount_amount",
        "subtotal_amount",
        "terms_accepted_at",
        "terms_version",
        "checkout_step",
        "payment_method",
    ):
        op.drop_column("booking_requests", name)
