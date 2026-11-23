"""Anonymous presence and read-only native source reporting."""

import hashlib
import hmac
from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pydantic import Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.nora.contracts import StrictModel
from app.integrations.nora.models import (
    NoraInstallation,
    NoraPageView,
    NoraPresence,
)
from app.models import BookingRequest, CustomerUser

PAGES = (
    ("home", "خانه", "/"),
    ("destinations", "مقصدها", "/destinations"),
    ("tours", "تورها", "/tours"),
    ("hotels", "هتل‌ها", "/hotels"),
    ("flights", "پرواز", "/services/flights"),
    ("trains", "قطار", "/services/trains"),
    ("buses", "اتوبوس", "/services/buses"),
    ("visas", "ویزا", "/services/?type=visa"),
    ("services", "خدمات", "/services"),
    ("articles", "مقالات", "/articles"),
    ("other", "سایر صفحات", ""),
)


class Heartbeat(StrictModel):
    browser_id: str = Field(alias="browserId", pattern=r"^[a-f0-9]{32}$")
    event_id: str = Field(alias="eventId", pattern=r"^[a-f0-9]{32}$")
    category: Literal[
        "home",
        "destinations",
        "tours",
        "hotels",
        "flights",
        "trains",
        "buses",
        "visas",
        "services",
        "articles",
        "other",
    ]


class ReportingRepository:
    """Bounded aggregate queries; no financial commands or private payloads."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def details(
        self,
        resource: str,
        after: int,
        metric: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        record_id: int | None = None,
    ) -> dict[str, Any]:
        if resource not in {"customer-accounts", "customer-orders"}:
            raise HTTPException(404, "report resource is not supported")
        model = CustomerUser if resource == "customer-accounts" else BookingRequest
        predicates = [model.id > after]
        if record_id is not None:
            predicates = [model.id == record_id]
        timestamp = model.created_at
        if metric:
            if (
                metric not in {"users", "orders", "sales", "pending"}
                or not from_date
                or not to_date
            ):
                raise HTTPException(422, "invalid report detail filters")
            if from_date > to_date or (to_date - from_date).days > 365:
                raise HTTPException(422, "invalid report period")
            if (metric == "users") != (resource == "customer-accounts"):
                raise HTTPException(422, "report metric does not match resource")
            if metric in {"sales", "pending"}:
                predicates.append(
                    BookingRequest.status
                    == ("paid" if metric == "sales" else "pending_review")
                )
            if metric == "sales":
                timestamp = BookingRequest.paid_at
            zone = ZoneInfo("Asia/Tehran")
            start = datetime.combine(from_date, time.min, zone).astimezone(UTC)
            end = datetime.combine(
                to_date + timedelta(days=1), time.min, zone
            ).astimezone(UTC)
            predicates.extend([timestamp >= start, timestamp < end])
        columns = [model.id, model.created_at, model.updated_at]
        if resource == "customer-orders":
            columns += [
                BookingRequest.booking_number,
                BookingRequest.status,
                BookingRequest.total_amount,
                BookingRequest.currency,
            ]
        rows = list(
            (
                await self.session.execute(
                    select(*columns).where(*predicates).order_by(model.id).limit(26)
                )
            ).all()
        )
        return {
            "items": [
                {
                    "externalId": str(row.id),
                    "siteId": "jahan-bastan",
                    "version": str(row.updated_at),
                    "data": {
                        "created_at": row.created_at.isoformat(),
                        **(
                            {
                                "booking_number": row.booking_number,
                                "status": row.status,
                                "total_amount": str(row.total_amount)
                                if row.total_amount is not None
                                else None,
                                "currency": row.currency,
                            }
                            if resource == "customer-orders"
                            else {}
                        ),
                    },
                }
                for row in rows[:25]
            ],
            "nextId": rows[24].id if len(rows) > 25 else 0,
            "hasMore": len(rows) > 25,
        }

    async def heartbeat(self, payload: Heartbeat) -> None:
        settings = get_settings()
        if not settings.NORA_PRESENCE_ENABLED:
            raise HTTPException(503, "anonymous tracking is not enabled")
        secret = settings.NORA_CONNECTOR_ENCRYPTION_KEY
        if secret is None:
            raise HTTPException(503, "tracking key is not configured")
        browser = hmac.new(
            secret.get_secret_value().encode(),
            ("presence:" + payload.browser_id).encode(),
            hashlib.sha256,
        ).hexdigest()
        now = datetime.now(UTC)
        await self.session.execute(
            delete(NoraPresence).where(
                NoraPresence.seen_at < now - timedelta(minutes=5)
            )
        )
        await self.session.execute(
            delete(NoraPageView).where(
                NoraPageView.created_at < now - timedelta(days=400)
            )
        )
        await self.session.execute(
            insert(NoraPresence)
            .values(
                browser_hash=browser,
                category=payload.category,
                seen_at=now,
            )
            .on_conflict_do_update(
                index_elements=["browser_hash"],
                set_={
                    "category": payload.category,
                    "seen_at": now,
                },
            )
        )
        await self.session.execute(
            insert(NoraPageView)
            .values(
                event_hash=hashlib.sha256(
                    (browser + payload.event_id).encode()
                ).hexdigest(),
                browser_hash=browser,
                category=payload.category,
                created_at=now,
            )
            .on_conflict_do_nothing(index_elements=["event_hash"])
        )
        await self.session.execute(
            update(NoraInstallation)
            .where(
                NoraInstallation.id == 1, NoraInstallation.tracking_started_at.is_(None)
            )
            .values(tracking_started_at=now)
        )
        await self.session.commit()

    async def presence(self) -> dict[str, Any]:
        enabled = get_settings().NORA_PRESENCE_ENABLED
        counts = (
            dict(
                (
                    await self.session.execute(
                        select(NoraPresence.category, func.count())
                        .where(
                            NoraPresence.seen_at
                            > datetime.now(UTC) - timedelta(seconds=90)
                        )
                        .group_by(NoraPresence.category)
                    )
                ).all()
            )
            if enabled
            else {}
        )
        return {
            "schemaVersion": 1,
            "mapKind": "SITE_NAVIGATION",
            "groups": [
                {"id": "travel", "title": "خدمات سفر"},
                {"id": "content", "title": "محتوا"},
                {"id": "misc", "title": "سایر صفحات"},
            ],
            "state": "ACTIVE" if enabled else "NOT_CONFIGURED",
            "checkedAt": datetime.now(UTC).isoformat(),
            "activeWindowSeconds": 90,
            "heartbeatSeconds": 25,
            "total": sum(counts.values()) if enabled else None,
            "nodes": [
                {
                    "id": code,
                    "title": title,
                    "kind": "page",
                    "group": "home"
                    if code == "home"
                    else "content"
                    if code == "articles"
                    else "misc"
                    if code == "other"
                    else "travel",
                    "column": i % 4,
                    "row": i // 4,
                    "count": counts.get(code, 0) if enabled else None,
                }
                for i, (code, title, _) in enumerate(PAGES)
            ],
            "edges": [
                {"from": "home", "to": code, "kind": "navigation"}
                for code, _, path in PAGES
                if path and code != "home"
            ],
        }

    async def report(self, from_date: date, to_date: date) -> dict[str, Any]:
        if from_date > to_date or (to_date - from_date).days > 365:
            raise HTTPException(422, "report supports at most 366 calendar days")
        zone = ZoneInfo("Asia/Tehran")
        start = datetime.combine(from_date, time.min, zone).astimezone(UTC)
        end = datetime.combine(to_date + timedelta(days=1), time.min, zone).astimezone(
            UTC
        )
        definitions = {
            "users": "Website accounts created in the selected Tehran calendar days.",
            "orders": "Website booking requests created in the selected period.",
            "sales": (
                "Paid site bookings by paid_at, excluding cancelled bookings; "
                "not net receipts."
            ),
            "pending": "Requests created in period and currently pending review.",
        }
        metrics: dict[str, Any] = {}
        trends: dict[str, Any] = {}
        for key, model, timestamp, predicates in (
            ("users", CustomerUser, CustomerUser.created_at, []),
            ("orders", BookingRequest, BookingRequest.created_at, []),
            (
                "sales",
                BookingRequest,
                BookingRequest.paid_at,
                [BookingRequest.status == "paid"],
            ),
            (
                "pending",
                BookingRequest,
                BookingRequest.created_at,
                [BookingRequest.status == "pending_review"],
            ),
        ):
            day = func.date(func.timezone("Asia/Tehran", timestamp))
            rows = (
                await self.session.execute(
                    select(day, func.count(model.id))
                    .where(timestamp >= start, timestamp < end, *predicates)
                    .group_by(day)
                    .order_by(day)
                )
            ).all()
            metrics[key] = {"value": sum(row[1] for row in rows), "state": "AVAILABLE"}
            trends[key] = [{"date": str(row[0]), "value": row[1]} for row in rows]
        sales = (
            await self.session.execute(
                select(
                    BookingRequest.currency,
                    func.sum(BookingRequest.total_amount),
                    func.count(BookingRequest.id),
                    func.count(BookingRequest.total_amount),
                )
                .where(
                    BookingRequest.paid_at >= start,
                    BookingRequest.paid_at < end,
                    BookingRequest.status == "paid",
                )
                .group_by(BookingRequest.currency)
            )
        ).all()
        installation = await self.session.get(NoraInstallation, 1)
        coverage = installation.tracking_started_at if installation else None
        views: list[Any] = []
        if coverage and get_settings().NORA_PRESENCE_ENABLED:
            day = func.date(func.timezone("Asia/Tehran", NoraPageView.created_at))
            views = list(
                (
                    await self.session.execute(
                        select(
                            day,
                            func.count(),
                            func.count(func.distinct(NoraPageView.browser_hash)),
                        )
                        .where(
                            NoraPageView.created_at >= start,
                            NoraPageView.created_at < end,
                        )
                        .group_by(day)
                        .order_by(day)
                    )
                ).all()
            )
        unique_browsers = (
            await self.session.scalar(
                select(func.count(func.distinct(NoraPageView.browser_hash))).where(
                    NoraPageView.created_at >= start, NoraPageView.created_at < end
                )
            )
            if coverage
            else None
        )
        return {
            "schemaVersion": 1,
            "from": str(from_date),
            "to": str(to_date),
            "checkedAt": datetime.now(UTC).isoformat(),
            "metrics": metrics,
            "totals": {},
            "trends": trends,
            "definitions": definitions,
            "salesByCurrency": [
                {
                    "currency": row[0],
                    "amount": str(row[1]) if row[1] is not None else None,
                    "complete": row[2] == row[3],
                }
                for row in sales
            ],
            "visits": {
                "available": bool(coverage and get_settings().NORA_PRESENCE_ENABLED),
                "coverageFrom": coverage.isoformat() if coverage else None,
                "pageViews": sum(row[1] for row in views),
                "uniqueBrowsers": unique_browsers,
                "definition": (
                    "Anonymous navigation events; history starts at "
                    "tracking activation."
                ),
                "daily": [
                    {"date": str(row[0]), "views": row[1], "visitors": row[2]}
                    for row in views
                ],
            },
            "activity": [],
            "activityAvailable": False,
            "warnings": [
                "Sales are read-only site facts; no Nora financial records are created."
            ],
        }
