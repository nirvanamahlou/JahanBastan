"""Join the buyer contact and city numbering migration histories."""

revision = "20261119_buyer_merge"
down_revision = ("20261119_buyer_contact", "20261118_hotels_merge")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
