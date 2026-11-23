"""Translate legacy English tour stage types to Persian."""

from alembic import op

revision = "20260921_0098"
down_revision = "20260921_0097"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE tour_travel_legs
        SET stage_type = CASE LOWER(BTRIM(stage_type))
            WHEN 'start' THEN 'شروع تور'
            WHEN 'beginning' THEN 'شروع تور'
            WHEN 'outbound' THEN 'رفت'
            WHEN 'departure' THEN 'رفت'
            WHEN 'movement' THEN 'پرواز یا جابه‌جایی'
            WHEN 'transport' THEN 'پرواز یا جابه‌جایی'
            WHEN 'transfer' THEN 'پرواز یا جابه‌جایی'
            WHEN 'flight' THEN 'پرواز یا جابه‌جایی'
            WHEN 'intercity' THEN 'جابه‌جایی بین‌شهری'
            WHEN 'arrival' THEN 'ورود و اقامت'
            WHEN 'stay' THEN 'ورود و اقامت'
            WHEN 'accommodation' THEN 'ورود و اقامت'
            WHEN 'sightseeing' THEN 'گشت و بازدید'
            WHEN 'tour' THEN 'گشت و بازدید'
            WHEN 'free_time' THEN 'زمان آزاد'
            WHEN 'free-time' THEN 'زمان آزاد'
            WHEN 'return' THEN 'برگشت'
            WHEN 'inbound' THEN 'برگشت'
            WHEN 'end' THEN 'پایان تور و بازگشت'
            WHEN 'finish' THEN 'پایان تور و بازگشت'
            ELSE BTRIM(stage_type)
        END
        WHERE stage_type IS NOT NULL
        """
    )


def downgrade() -> None:
    # The previous Persian values cannot be distinguished safely from values
    # entered in Persian by an administrator, so the normalized data is kept.
    pass
