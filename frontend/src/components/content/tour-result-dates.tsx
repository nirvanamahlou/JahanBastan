"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";
import styles from "./catalog-layout.module.css";

type Range = { departureDate: string; returnDate: string | null; price: string | null };
type Departure = {
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
        const key = `${item.departureDate}|${item.returnDate ?? ""}|${price ?? ""}`;
        unique.set(key, { departureDate: item.departureDate, returnDate: item.returnDate, price });
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
  return (
    <details className={styles.dateDisclosure} onToggle={(event) => {
      if (event.currentTarget.open) void loadDates();
    }}>
      <summary><span className={styles.showDates}>مشاهده تاریخ‌ها</span><span className={styles.hideDates}>بستن تاریخ‌ها</span></summary>
      <div className={styles.dateBody}>
        {loading && <p role="status">در حال دریافت تاریخ‌ها…</p>}
        {visible.length ? <ul className={styles.dateRanges}>
          {visible.map((range, index) => <li key={`${range.departureDate}-${range.returnDate}-${index}`}>
            <div><span>رفت</span><time dateTime={range.departureDate}>{formatPersianDate(range.departureDate)}</time></div>
            {range.returnDate && <div><span>برگشت</span><time dateTime={range.returnDate}>{formatPersianDate(range.returnDate)}</time></div>}
            {range.price && <strong>{range.price}</strong>}
          </li>)}
        </ul> : !loading && <p>تاریخ سفر را در جزئیات تور بررسی کنید.</p>}
        <Link className={styles.dateLink} href={href}>مشاهده جزئیات تور ←</Link>
      </div>
    </details>
  );
}
