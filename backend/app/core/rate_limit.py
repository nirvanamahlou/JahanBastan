"""Distributed rate limiting and trusted-proxy client address resolution."""

from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from redis.asyncio import Redis
from redis.exceptions import RedisError


@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int


DEFAULT_RATE_LIMITS: dict[str, RateLimitRule] = {
    "/api/v1/activity/nora-presence": RateLimitRule(120, 60),
    "/api/v1/auth/login": RateLimitRule(10, 300),
    "/api/v1/auth/password-reset/request": RateLimitRule(5, 3600),
    "/api/v1/auth/password-reset/confirm": RateLimitRule(10, 900),
    "/api/v1/account/login": RateLimitRule(20, 300),
    "/api/v1/account/register": RateLimitRule(10, 3600),
    "/api/v1/account/password-reset/request": RateLimitRule(5, 3600),
    "/api/v1/account/sms/request": RateLimitRule(5, 600),
    "/api/v1/newsletter/subscribers": RateLimitRule(10, 3600),
    "/api/v1/support/conversations": RateLimitRule(20, 3600),
}


class RateLimiterUnavailable(RuntimeError):
    pass


def resolve_client_address(
    direct_address: str,
    forwarded_for: str | None,
    trusted_proxy_cidrs: list[str],
) -> str:
    """Honor X-Forwarded-For only when the immediate peer is a trusted proxy."""
    try:
        direct_ip = ipaddress.ip_address(direct_address)
        trusted = any(
            direct_ip in ipaddress.ip_network(cidr, strict=False)
            for cidr in trusted_proxy_cidrs
        )
    except ValueError:
        trusted = False
    if trusted and forwarded_for:
        candidate = forwarded_for.split(",", 1)[0].strip()
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            pass
    return direct_address


class SlidingWindowRateLimiter:
    """Redis-backed fixed window with a safe in-process development fallback."""

    def __init__(
        self,
        rules: dict[str, RateLimitRule] | None = None,
        *,
        redis_url: str | None = None,
        production: bool = False,
    ) -> None:
        self.rules = rules or DEFAULT_RATE_LIMITS
        self.production = production
        self.redis = (
            Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
            if redis_url
            else None
        )
        self._requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def close(self) -> None:
        if self.redis is not None:
            await self.redis.aclose()

    async def check(
        self,
        client_address: str,
        path: str,
        *,
        now: float | None = None,
    ) -> int | None:
        rule = self.rules.get(path)
        if rule is None:
            return None
        if self.redis is not None:
            fingerprint = hashlib.sha256(client_address.encode()).hexdigest()[:32]
            bucket = int(time.time()) // rule.window_seconds
            key = f"ratelimit:{path}:{fingerprint}:{bucket}"
            try:
                count = await self.redis.incr(key)
                if count == 1:
                    await self.redis.expire(key, rule.window_seconds + 2)
                if count > rule.limit:
                    ttl = await self.redis.ttl(key)
                    return max(1, int(ttl))
                return None
            except RedisError as exc:
                if self.production:
                    raise RateLimiterUnavailable from exc
        return await self._check_local(client_address, path, rule, now=now)

    async def _check_local(
        self,
        client_address: str,
        path: str,
        rule: RateLimitRule,
        *,
        now: float | None,
    ) -> int | None:
        timestamp = time.monotonic() if now is None else now
        cutoff = timestamp - rule.window_seconds
        key = (client_address, path)
        async with self._lock:
            entries = self._requests[key]
            while entries and entries[0] <= cutoff:
                entries.popleft()
            if len(entries) >= rule.limit:
                return max(1, int(entries[0] + rule.window_seconds - timestamp) + 1)
            entries.append(timestamp)
        return None
