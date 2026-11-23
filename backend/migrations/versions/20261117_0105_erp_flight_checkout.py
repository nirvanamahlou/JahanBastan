"""Add durable idempotent ERP flight checkout state."""

from alembic import op

revision = "20261117_0105"
down_revision = "20261116_0104"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE erp_flight_checkouts (
            id UUID PRIMARY KEY,
            customer_id BIGINT NOT NULL REFERENCES customer_users(id) ON DELETE RESTRICT,
            external_id VARCHAR(100) NOT NULL UNIQUE,
            request_fingerprint VARCHAR(64) NOT NULL,
            request_payload JSONB NOT NULL,
            erp_payload JSONB,
            state VARCHAR(24) NOT NULL DEFAULT 'received'
                CHECK (state IN ('received','preparing','prepared','dispatching','uncertain','draft','failed')),
            lease_token VARCHAR(64),
            lease_expires_at TIMESTAMPTZ,
            erp_contract_id VARCHAR(100),
            erp_contract_number VARCHAR(100),
            erp_status VARCHAR(40),
            error_code VARCHAR(80),
            error_message TEXT,
            error_retryable BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX idx_erp_flight_checkouts_customer_created
            ON erp_flight_checkouts(customer_id, created_at);
        CREATE INDEX idx_erp_flight_checkouts_state_lease
            ON erp_flight_checkouts(state, lease_expires_at);
    """)


def downgrade() -> None:
    op.drop_table("erp_flight_checkouts")
