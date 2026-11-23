"""Small, centralised helpers for converting catalog amounts to Toman."""

from collections.abc import Mapping
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal, InvalidOperation


def exchange_rates_from_links(links: Mapping[str, object] | None) -> dict[str, Decimal]:
    """Read the manually managed rates from site settings.

    Rates are stored as Toman per one unit of the foreign currency. Missing or
    invalid values are intentionally left at zero so callers can keep an item
    pending review instead of silently applying a wrong rate.
    """

    links = links or {}

    def read(key: str) -> Decimal:
        try:
            value = Decimal(str(links.get(key, "0")))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal("0")
        return value if value > 0 else Decimal("0")

    return {"USD": read("exchangeRateUsdIrt"), "EUR": read("exchangeRateEurIrt")}


def round_foreign_currency_up(amount: Decimal, currency: str | None) -> Decimal:
    """Round USD/EUR prices upward to the next whole currency unit."""

    code = (currency or "IRT").upper()
    if code in {"USD", "EUR"}:
        return amount.to_integral_value(rounding=ROUND_CEILING)
    return amount


def to_toman(
    amount: Decimal | int | float | str,
    currency: str | None,
    rates: Mapping[str, Decimal],
) -> Decimal | None:
    """Convert an amount to IRT/Toman, or return ``None`` when unavailable."""

    try:
        value = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError):
        return None
    code = (currency or "IRT").upper()
    if code in {"IRT", "TOMAN", "تومان"}:
        return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if code in {"IRR", "RIAL", "ریال"}:
        # Catalog imports commonly keep hotel add-ons in Rial while checkout
        # totals are stored in Toman. Ten Rial equals one Toman.
        return (value / Decimal("10")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if code == "USD":
        rate = rates.get("USD", Decimal("0"))
    elif code == "EUR":
        rate = rates.get("EUR", Decimal("0"))
    else:
        return None
    if rate <= 0:
        return None
    rounded_value = round_foreign_currency_up(value, code)
    return (rounded_value * rate).quantize(Decimal("1"), rounding=ROUND_CEILING)


def item_total_to_toman(item: object, rates: Mapping[str, Decimal]) -> Decimal | None:
    """Resolve a cart/booking item, including split hotel + flight pricing."""

    price_amount = getattr(item, "price_amount", None)
    currency = getattr(item, "currency", None)
    if price_amount is not None and currency:
        return to_toman(price_amount, currency, rates)

    components = (
        (getattr(item, "hotel_amount", None), getattr(item, "hotel_currency", None)),
        (getattr(item, "flight_amount", None), getattr(item, "flight_currency", None)),
    )
    if not any(amount is not None for amount, _ in components):
        return None
    total = Decimal("0")
    for amount, code in components:
        if amount is None:
            continue
        converted = to_toman(amount, code, rates)
        if converted is None:
            return None
        total += converted
    return total.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
