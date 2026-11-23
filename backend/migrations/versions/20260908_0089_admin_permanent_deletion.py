"""Preserve login and pricing history when an administrator is deleted."""

import sqlalchemy as sa
from alembic import op

revision = "20260908_0089"
down_revision = "20260908_0088"
branch_labels = None
depends_on = None

TABLES = (
    ("admin_sessions", "admin_user_id", "CASCADE"),
    ("bulk_price_adjustments", "admin_id", "RESTRICT"),
)


def replace_foreign_key(table: str, column: str, ondelete: str) -> None:
    for foreign_key in sa.inspect(op.get_bind()).get_foreign_keys(table):
        if foreign_key["constrained_columns"] == [column]:
            op.drop_constraint(foreign_key["name"], table, type_="foreignkey")
    op.create_foreign_key(
        f"fk_{table}_{column}",
        table,
        "admin_users",
        [column],
        ["id"],
        ondelete=ondelete,
    )


def upgrade() -> None:
    for table, column, _ in TABLES:
        op.alter_column(table, column, existing_type=sa.BigInteger(), nullable=True)
        replace_foreign_key(table, column, "SET NULL")


def downgrade() -> None:
    # Never discard historical rows merely to restore a NOT NULL constraint.
    for table, column, _ in TABLES:
        if op.get_bind().scalar(
            sa.text(f"SELECT count(*) FROM {table} WHERE {column} IS NULL")
        ):
            raise RuntimeError(
                "Cannot downgrade while deleted administrator history exists"
            )
    for table, column, ondelete in TABLES:
        replace_foreign_key(table, column, ondelete)
        op.alter_column(table, column, existing_type=sa.BigInteger(), nullable=False)
