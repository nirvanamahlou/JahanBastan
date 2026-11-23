"""Preserve the source code for Avina-linked hotel profiles."""

from alembic import op

revision = "20261121_avina_hotel_code"
down_revision = "20261119_buyer_merge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE FUNCTION preserve_avina_hotel_code() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.avina_identification_code IS NOT NULL THEN
                NEW.hotel_code := NEW.avina_identification_code;
                IF NEW.hotel_code ~ '^HTL-[A-Z]{3}-[0-9]{3,18}$' THEN
                    IF to_regclass('hotel_city_counters') IS NOT NULL THEN
                        UPDATE hotel_city_counters
                        SET last_number = greatest(last_number, substring(NEW.hotel_code FROM 9)::bigint)
                        WHERE destination_id = NEW.destination_id;
                    ELSIF NEW.hotel_code LIKE 'HTL-AYT-%'
                          AND to_regclass('antalya_hotel_code_seq') IS NOT NULL THEN
                        PERFORM setval('antalya_hotel_code_seq', greatest(
                            (SELECT last_value FROM antalya_hotel_code_seq),
                            substring(NEW.hotel_code FROM 9)::bigint
                        ));
                    END IF;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER preserve_avina_hotel_code
        BEFORE INSERT OR UPDATE OF destination_id, hotel_code, avina_identification_code
        ON hotels FOR EACH ROW EXECUTE FUNCTION preserve_avina_hotel_code();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER preserve_avina_hotel_code ON hotels")
    op.execute("DROP FUNCTION preserve_avina_hotel_code()")
