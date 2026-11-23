"""Allocate sequential hotel codes independently for each destination."""

from alembic import op

revision = "20261118_0106"
down_revision = "20261118_0105"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("LOCK TABLE hotels IN SHARE ROW EXCLUSIVE MODE")
    op.execute("DROP TRIGGER assign_antalya_hotel_code ON hotels")
    op.execute("""
        CREATE TABLE hotel_city_counters (
            destination_id bigint PRIMARY KEY REFERENCES destinations(id) ON DELETE CASCADE,
            code varchar(3) UNIQUE NOT NULL CHECK (code ~ '^[A-Z]{3}$'),
            last_number bigint NOT NULL
        )
    """)
    op.execute("""
        CREATE FUNCTION ensure_hotel_city_counter(city_id bigint) RETURNS varchar
        LANGUAGE plpgsql AS $$
        DECLARE
            city_slug text;
            city_letters text;
            preferred text;
            candidate varchar;
            result varchar;
        BEGIN
            SELECT code INTO result FROM hotel_city_counters WHERE destination_id = city_id;
            IF FOUND THEN RETURN result; END IF;
            PERFORM pg_advisory_xact_lock(19682026, 3);
            SELECT code INTO result FROM hotel_city_counters WHERE destination_id = city_id;
            IF FOUND THEN RETURN result; END IF;
            SELECT slug INTO STRICT city_slug FROM destinations WHERE id = city_id;
            preferred := CASE city_slug
                WHEN 'antalya-turkey' THEN 'AYT' WHEN 'bangkok' THEN 'BKK'
                WHEN 'kuala-lumpur-malaysia' THEN 'KUL' WHEN 'singapore' THEN 'SIN'
                WHEN 'penang-malaysia' THEN 'PEN' WHEN 'kusadasi-turkey' THEN 'KUS'
                WHEN 'pattaya' THEN 'PTY' WHEN 'phuket' THEN 'HKT'
                WHEN 'aix-en-provence-france' THEN 'AIX' WHEN 'athens-greece' THEN 'ATH'
                WHEN 'bali-indonesia' THEN 'DPS' WHEN 'barcelona-spain' THEN 'BCN'
                WHEN 'beijing-china' THEN 'PEK' WHEN 'bodrum-turkey' THEN 'BJV'
                WHEN 'chengdu-china' THEN 'CTU' WHEN 'da-nang-vietnam' THEN 'DAD'
                WHEN 'ha-long-bay-vietnam' THEN 'HLB' WHEN 'hanoi-vietnam' THEN 'HAN'
                WHEN 'ho-chi-minh-city-vietnam' THEN 'SGN' WHEN 'istanbul-turkey' THEN 'IST'
                WHEN 'kish' THEN 'KIH' WHEN 'langkawi-malaysia' THEN 'LGK'
                WHEN 'lisbon-portugal' THEN 'LIS' WHEN 'ljubljana-slovenia' THEN 'LJU'
                WHEN 'madrid-spain' THEN 'MAD' WHEN 'mashhad' THEN 'MHD'
                WHEN 'nice-france' THEN 'NCE' WHEN 'paris-france' THEN 'PAR'
                WHEN 'prague-czech-republic' THEN 'PRG' WHEN 'qeshm-iran' THEN 'GSM'
                WHEN 'rome-italy' THEN 'ROM' WHEN 'seville-spain' THEN 'SVQ'
                WHEN 'shanghai-china' THEN 'SHA' WHEN 'venice-italy' THEN 'VCE'
                WHEN 'warsaw-poland' THEN 'WAW' WHEN 'zhangjiajie-china' THEN 'DYG'
                WHEN 'zurich-switzerland' THEN 'ZRH'
            END;
            city_letters := regexp_replace(upper(city_slug), '[^A-Z]', '', 'g');
            SELECT option_code INTO candidate
            FROM (
                SELECT preferred AS option_code, 0 AS priority
                UNION ALL SELECT left(city_letters, 3), 1
                UNION ALL
                SELECT left(city_letters, 1) || chr(a) || chr(b), 2
                FROM generate_series(65, 90) a CROSS JOIN generate_series(65, 90) b
                UNION ALL
                SELECT chr(a) || chr(b) || chr(c), 3
                FROM generate_series(65, 90) a CROSS JOIN generate_series(65, 90) b
                CROSS JOIN generate_series(65, 90) c
            ) options
            WHERE option_code ~ '^[A-Z]{3}$'
              AND NOT EXISTS (SELECT 1 FROM hotel_city_counters WHERE code = option_code)
            ORDER BY priority, option_code LIMIT 1;
            IF candidate IS NULL THEN RAISE EXCEPTION 'No hotel city codes available'; END IF;

            INSERT INTO hotel_city_counters (destination_id, code, last_number)
            SELECT city_id, candidate, COALESCE(MAX(substring(hotel_code FROM 9)::bigint), 0)
            FROM hotels WHERE hotel_code ~ ('^HTL-' || candidate || '-[0-9]{1,18}$');
            RETURN candidate;
        END;
        $$
    """)
    op.execute("""
        CREATE FUNCTION assign_city_hotel_code() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE city_prefix varchar;
        DECLARE code_number text;
        BEGIN
            city_prefix := ensure_hotel_city_counter(NEW.destination_id);
            IF TG_OP = 'UPDATE' THEN
                IF OLD.destination_id = NEW.destination_id AND
                   OLD.hotel_code ~ ('^HTL-' || city_prefix || '-[0-9]{3,18}$') THEN
                    NEW.hotel_code := OLD.hotel_code;
                    RETURN NEW;
                END IF;
            END IF;
            UPDATE hotel_city_counters SET last_number = last_number + 1
            WHERE destination_id = NEW.destination_id
            RETURNING last_number::text INTO code_number;
            NEW.hotel_code := 'HTL-' || city_prefix || '-' ||
                lpad(code_number, greatest(3, length(code_number)), '0');
            RETURN NEW;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER assign_city_hotel_code
        BEFORE INSERT OR UPDATE OF destination_id, hotel_code ON hotels
        FOR EACH ROW EXECUTE FUNCTION assign_city_hotel_code()
    """)
    op.execute("""
        DO $$
        DECLARE city_id bigint;
        DECLARE hotel_id bigint;
        BEGIN
            FOR city_id IN SELECT id FROM destinations ORDER BY
                (slug = 'antalya-turkey') DESC, id
            LOOP
                PERFORM ensure_hotel_city_counter(city_id);
            END LOOP;
            FOR hotel_id IN
                SELECT h.id FROM hotels h JOIN hotel_city_counters c
                    ON c.destination_id = h.destination_id
                WHERE h.hotel_code !~ ('^HTL-' || c.code || '-[0-9]{3,18}$')
                ORDER BY h.id
            LOOP
                UPDATE hotels SET hotel_code = hotels.hotel_code WHERE id = hotel_id;
            END LOOP;
        END;
        $$
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER assign_city_hotel_code ON hotels")
    op.execute("DROP FUNCTION assign_city_hotel_code()")
    op.execute("DROP FUNCTION ensure_hotel_city_counter(bigint)")
    op.execute("DROP TABLE hotel_city_counters")
    op.execute("""
        SELECT setval('antalya_hotel_code_seq', greatest(
            (SELECT last_value FROM antalya_hotel_code_seq),
            COALESCE(MAX(substring(hotel_code FROM 9)::bigint), 0)
        ))
        FROM hotels WHERE hotel_code ~ '^HTL-AYT-[0-9]{3,18}$'
    """)
    op.execute("""
        CREATE TRIGGER assign_antalya_hotel_code
        BEFORE INSERT OR UPDATE OF destination_id, hotel_code ON hotels
        FOR EACH ROW EXECUTE FUNCTION assign_antalya_hotel_code()
    """)
