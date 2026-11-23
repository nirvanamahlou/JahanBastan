"""Store local editorial overrides independently of Avina catalog snapshots."""

from alembic import op

revision = "20261122_avina_tour_editorial"
down_revision = "20261121_avina_hotel_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE avina_tour_editorial (
            kind text NOT NULL CHECK (kind IN ('tour', 'floating-tour')),
            resource_id text NOT NULL,
            title text,
            summary text,
            description text,
            hidden boolean NOT NULL DEFAULT false,
            PRIMARY KEY (kind, resource_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE avina_tour_editorial")
