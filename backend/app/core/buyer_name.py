"""Name handling for checkout and legacy phone-only accounts."""

LEGACY_CUSTOMER_NAME = "کاربر جهان باستان"
BUYER_NAME_REQUIRED = "نام و نام خانوادگی خریدار را کامل وارد کنید."


def customer_display_name(value: str) -> str:
    name = " ".join(value.split())
    return "" if name == LEGACY_CUSTOMER_NAME else name


def valid_buyer_name(value: str) -> bool:
    parts = customer_display_name(value).split()
    return len(parts) >= 2 and all(any(ch.isalpha() for ch in part) for part in parts)
