"""Date-specific prices for an existing, ordered multi-hotel package."""

from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Identity,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TourCombinedDeparturePrice(Base):
    __tablename__ = "tour_combined_departure_prices"
    __table_args__ = (
        UniqueConstraint(
            "package_id", "departure_id", name="uq_combined_departure_price"
        ),
        *(
            CheckConstraint(
                f"{field}_price IS NULL OR {field}_price >= 0",
                name=f"chk_combined_date_{field}",
            )
            for field in (
                "double",
                "single",
                "child_with_bed",
                "child_without_bed",
                "infant",
                "regular_flight",
                "child_with_bed_flight",
                "extra",
            )
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    package_id: Mapped[int] = mapped_column(
        ForeignKey("tour_combined_packages.id", ondelete="CASCADE")
    )
    departure_id: Mapped[int] = mapped_column(
        ForeignKey("tour_departures.id", ondelete="CASCADE"), index=True
    )
    double_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    double_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    single_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    single_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    child_with_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    child_with_bed_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    child_without_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    child_without_bed_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    infant_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    infant_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    infant_supplement_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "infant_supplement_price IS NULL OR infant_supplement_price >= 0",
            name="chk_combined_date_infant_supplement",
        ),
    )
    infant_supplement_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    double_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "double_flight_price IS NULL OR double_flight_price >= 0",
            name="chk_tour_combined_departure_prices_double_flight_price",
        ),
    )
    single_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "single_flight_price IS NULL OR single_flight_price >= 0",
            name="chk_tour_combined_departure_prices_single_flight_price",
        ),
    )
    regular_flight_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    regular_flight_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    child_with_bed_flight_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    child_with_bed_flight_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    extra_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    extra_currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRT'"))
