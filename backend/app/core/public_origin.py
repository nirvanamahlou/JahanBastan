"""Canonical deployment origins; request Host headers never establish identity."""

import ipaddress
import re
from urllib.parse import urlsplit


def public_origin(value: str, *, allow_test_loopback: bool = False) -> str:
    """Require a public HTTPS hostname, with an explicit isolated-test exception."""
    if not isinstance(value, str) or any(ord(c) < 33 for c in value):
        raise ValueError("a configured public HTTPS origin is required")
    try:
        url = urlsplit(value)
        hostname = (url.hostname or "").encode("idna").decode("ascii").lower()
        port = url.port
    except (ValueError, UnicodeError) as exc:
        raise ValueError("a configured public HTTPS origin is required") from exc
    if (
        not hostname
        or url.username is not None
        or url.password is not None
        or url.query
        or url.fragment
        or url.path not in {"", "/"}
        or "\\" in value
    ):
        raise ValueError("a configured public HTTPS origin is required")
    if allow_test_loopback and hostname in {"localhost", "127.0.0.1"}:
        if url.scheme != "http":
            raise ValueError("isolated test loopback must use HTTP")
        return f"http://{hostname}" + (f":{port}" if port else "")
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise ValueError("a public hostname is required")
    if (
        url.scheme != "https"
        or port not in {None, 443}
        or "." not in hostname
        or hostname.endswith((".localhost", ".local", ".internal"))
        or hostname.rsplit(".", 1)[-1].isdigit()
        or len(hostname) > 253
        or any(
            not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
            for label in hostname.split(".")
        )
    ):
        raise ValueError("a configured public HTTPS origin is required")
    return f"https://{hostname}"
