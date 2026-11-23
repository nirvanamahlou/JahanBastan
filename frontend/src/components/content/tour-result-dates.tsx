"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";
import { isTourDepartureBookable, type TourDepartureAvailability } from "@/lib/tour-departure-availability";
import styles from "./catalog-layout.module.css";

type Range = {
  departureDate: string;
  returnDate: string | null;
  price: string | null;
  comparablePrice?: { amount: number; currency: string };
};
type Departure = TourDepartureAvailability & {
  departureDate: string | null;
  returnDate: string | null;
  priceAmount: string | null;
  currency: string | null;
};

export function TourResultDates({
  href,
  slug,
  fallback,
}: {
  href: string;
  slug: string | null;
  fallback: Range | null;
}) {
  const [ranges, setRanges] = useState<Range[] | null>(null);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  async function loadDates() {
    if (!slug || ranges || pending.current) return;
    pending.current = true;
    setLoading(true);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/tours/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return;
      const data: { departures?: Departure[] } = await response.json();
      const unique = new Map<string, Range>();
      for (const item of data.departures ?? []) {
        if (!item.departureDate) continue;
        const price = item.priceAmount ? formatCurrency(item.priceAmount, item.currency) : null;
        const amount = Number(item.priceAmount);
        const currency = item.currency?.trim().toUpperCase();
        const comparablePrice = currency && Number.isFinite(amount) && amount > 0 && isTourDepartureBookable(item)
          ? { amount, currency }
          : undefined;
        const key = `${item.departureDate}|${item.returnDate ?? ""}|${price ?? ""}`;
        if (!unique.has(key) || comparablePrice) {
          unique.set(key, { departureDate: item.departureDate, returnDate: item.returnDate, price, comparablePrice });
        }
      }
      setRanges([...unique.values()].sort((a, b) => a.departureDate.localeCompare(b.departureDate)));
    } catch {
      // Keep the catalogue date visible if the details request is unavailable.
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  const visible = ranges?.length ? ranges : fallback ? [fallback] : [];
  const cheapest = cheapestRange(visible);
  return (
    <details className={styles.dateDisclosure} onToggle={(event) => {
      if (event.currentTarget.open) void loadDates();
    }}>
      <summary><span className={styles.showDates}>مشاهده تاریخ‌ها</span><span className={styles.hideDates}>بستن تاریخ‌ها</span></summary>
      <div className={styles.dateBody}>
        {loading && <p role="status">در حال دریافت تاریخ‌ها…</p>}
        {visible.length ? <>
          <p className={styles.dateHeading}>بازه‌های سفر</p>
          <ul className={styles.dateRanges}>
            {visible.map((range) => (
              <li className={`${styles.dateRange} ${range === cheapest ? styles.dateRangeBest : ""}`} key={`${range.departureDate}|${range.returnDate}|${range.price}`}>
                {range === cheapest && <span className={styles.dateBestLabel}>کمترین قیمت ثبت‌شده</span>}
                <div className={styles.datePoint}>
                  <span>رفت</span>
                  <time dateTime={range.departureDate}>{formatPersianDate(range.departureDate)}</time>
                </div>
                <div className={styles.datePrice}>
                  <span>شروع قیمت</span>
                  <strong>{range.price ?? "استعلام قیمت"}</strong>
                </div>
                <div className={styles.datePoint}>
                  <span>برگشت</span>
                  {range.returnDate ? <time dateTime={range.returnDate}>{formatPersianDate(range.returnDate)}</time> : <strong>—</strong>}
                </div>
              </li>
            ))}
          </ul>
        </> : !loading && <p>تاریخ سفر را در جزئیات تور بررسی کنید.</p>}
        <Link className={styles.dateLink} href={href}>مشاهده جزئیات تور ←</Link>
      </div>
    </details>
  );
}

function cheapestRange(ranges: readonly Range[]) {
  const comparable = ranges.flatMap((range) =>
    range.comparablePrice ? [{ range, ...range.comparablePrice }] : [],
  );
  if (comparable.length < 2) return undefined;
  if (ranges.some((range) => range.price && range.comparablePrice?.currency !== comparable[0].currency)) return undefined;
  comparable.sort((a, b) => a.amount - b.amount);
  const [lowest] = comparable;
  return lowest.amount < comparable[comparable.length - 1].amount ? lowest.range : undefined;
}
