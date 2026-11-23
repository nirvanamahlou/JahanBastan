"""Canonical Persian labels for tour travel-stage types."""

_STAGE_TYPE_LABELS = {
    "start": "شروع تور",
    "beginning": "شروع تور",
    "outbound": "رفت",
    "departure": "رفت",
    "movement": "پرواز یا جابه‌جایی",
    "transport": "پرواز یا جابه‌جایی",
    "transfer": "پرواز یا جابه‌جایی",
    "flight": "پرواز یا جابه‌جایی",
    "intercity": "جابه‌جایی بین‌شهری",
    "arrival": "ورود و اقامت",
    "stay": "ورود و اقامت",
    "accommodation": "ورود و اقامت",
    "sightseeing": "گشت و بازدید",
    "tour": "گشت و بازدید",
    "free_time": "زمان آزاد",
    "free-time": "زمان آزاد",
    "return": "برگشت",
    "inbound": "برگشت",
    "end": "پایان تور و بازگشت",
    "finish": "پایان تور و بازگشت",
}


def normalize_tour_stage_type(value: object) -> object:
    """Trim a stage type and translate supported legacy English values."""

    if value is None or not isinstance(value, str):
        return value
    normalized = value.strip()
    if not normalized:
        return None
    return _STAGE_TYPE_LABELS.get(normalized.casefold(), normalized)
