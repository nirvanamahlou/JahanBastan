"""Assign sequential HTL-AYT codes to Antalya hotels."""

from alembic import op

revision = "20261118_0105"
down_revision = "20261116_0104"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        LOCK TABLE hotels IN SHARE ROW EXCLUSIVE MODE;
    """)
    op.execute("""
        CREATE SEQUENCE antalya_hotel_code_seq;
    """)
    op.execute("""
        SELECT setval(
            'antalya_hotel_code_seq',
            COALESCE(MAX(substring(hotel_code FROM 9)::bigint), 0) + 1,
            false
        )
        FROM hotels
        WHERE hotel_code ~ '^HTL-AYT-[0-9]{3,}$';

    """)
    op.execute("""
        WITH missing AS (
            SELECT h.id, nextval('antalya_hotel_code_seq')::text AS number
            FROM hotels h JOIN destinations d ON d.id = h.destination_id
            WHERE d.slug = 'antalya-turkey'
              AND h.hotel_code !~ '^HTL-AYT-[0-9]{3,}$'
            ORDER BY h.id
        )
        UPDATE hotels h
        SET hotel_code = 'HTL-AYT-' || lpad(m.number, greatest(3, length(m.number)), '0')
        FROM missing m WHERE h.id = m.id;

    """)
    op.execute("""
        CREATE FUNCTION assign_antalya_hotel_code() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE code_number text;
        BEGIN
            IF EXISTS (
                SELECT 1 FROM destinations
                WHERE id = NEW.destination_id AND slug = 'antalya-turkey'
            ) THEN
                IF TG_OP = 'UPDATE' THEN
                    IF OLD.hotel_code ~ '^HTL-AYT-[0-9]{3,}$' THEN
                        NEW.hotel_code := OLD.hotel_code;
                        RETURN NEW;
                    END IF;
                END IF;
                code_number := nextval('antalya_hotel_code_seq')::text;
                NEW.hotel_code := 'HTL-AYT-' ||
                    lpad(code_number, greatest(3, length(code_number)), '0');
            END IF;
            RETURN NEW;
        END;
        $$;

    """)
    op.execute("""
        CREATE TRIGGER assign_antalya_hotel_code
        BEFORE INSERT OR UPDATE OF destination_id, hotel_code ON hotels
        FOR EACH ROW EXECUTE FUNCTION assign_antalya_hotel_code();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER assign_antalya_hotel_code ON hotels")
    op.execute("DROP FUNCTION assign_antalya_hotel_code()")
    op.execute("DROP SEQUENCE antalya_hotel_code_seq")
