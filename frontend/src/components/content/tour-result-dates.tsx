"use client";

import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { hasBookableTourPackage, tourReturnDate } from "@/lib/tour-departure-availability";
import type { PublicCombinedPackage } from "@/types/combined-pricing";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";
import { CalendarIcon } from "@/components/layout/site-icons";
import styles from "./catalog-layout.module.css";

type Range = {
  departureId?: number;
  departureDate: string;
  returnDate: string | null;
  nights?: number | null;
  price: string | null;
};
type Departure = Parameters<typeof hasBookableTourPackage>[0] & {
  id: number;
  departureDate: string | null;
  returnDate: string | null;
  nights?: number | null;
  priceAmount: string | null;
  currency: string | null;
};

export function TourResultDates({
  href,
  slug,
  fallback,
  summaryContent,
}: {
  href: string;
  slug: string | null;
  fallback: Range | null;
  summaryContent: ReactNode;
}) {
  const [ranges, setRanges] = useState<Range[] | null>(null);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const [failed, setFailed] = useState(false);

  async function loadDates() {
    if (!slug || ranges || pending.current) return;
    pending.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/tours/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Could not load tour dates");
      const data: { departures?: Departure[]; combinedPackages?: PublicCombinedPackage[] } = await response.json();
      const unique = new Map<string, Range>();
      for (const item of data.departures ?? []) {
        if (!item.departureDate || !hasBookableTourPackage(item, data.combinedPackages)) continue;
        const price = item.priceAmount ? formatCurrency(item.priceAmount, item.currency) : null;
        const key = String(item.id);
        if (!unique.has(key)) {
          unique.set(key, { departureId: item.id, departureDate: item.departureDate, returnDate: tourReturnDate(item.departureDate, item.returnDate, item.nights), nights: item.nights, price });
        }
      }
      setRanges([...unique.values()].sort((a, b) => a.departureDate.localeCompare(b.departureDate)));
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  const visible = slug ? ranges ?? [] : fallback ? [fallback] : [];
  return (
    <details className={styles.dateDisclosure} onToggle={(event) => {
      if (event.currentTarget.open) void loadDates();
    }}>
      <summary>
        {summaryContent}
        <span className={styles.dateToggle}>
          <span className={styles.showDates}>مشاهده تاریخ‌ها</span>
          <span className={styles.hideDates}>بستن تاریخ‌ها</span>
        </span>
      </summary>
      <div className={styles.dateBody}>
        {loading && <p role="status">در حال دریافت تاریخ‌ها…</p>}
        {failed && <p role="status">دریافت تاریخ‌ها انجام نشد. <button type="button" className="underline" onClick={() => void loadDates()}>تلاش دوباره</button></p>}
        {ranges?.length === 0 && <p role="status">در حال حاضر تاریخ قابل رزروی برای این تور وجود ندارد.</p>}
        {visible.length ? <>
          <p className={styles.dateHeading}>بازه‌های سفر</p>
          <ul className={styles.dateRanges}>
            {visible.map((range) => {
              const query = range.departureId ? `?departureId=${range.departureId}` : "";
              const rangeHref = slug ? `${href}${query}` : href;
              const nights = getNightCount(range);
              return (
                <li key={range.departureId ?? range.departureDate}>
                  <Link className={styles.dateRange} href={rangeHref} prefetch={false}>
                    <div className={styles.datePoint}>
                      <span>رفت</span>
                      <time dateTime={range.departureDate}>{formatPersianDate(range.departureDate)}</time>
                    </div>
                    <span className={styles.dateArrow} aria-hidden="true">←</span>
                    <div className={styles.datePoint}>
                      <span>برگشت</span>
                      {range.returnDate ? <time dateTime={range.returnDate}>{formatPersianDate(range.returnDate)}</time> : <strong>—</strong>}
                    </div>
                    <div className={styles.dateCardFooter}>
                      {nights !== null && <span className={styles.dateNights}><CalendarIcon aria-hidden="true" className="size-3.5" />{nights.toLocaleString("fa-IR")} شب</span>}
                      <span>شروع قیمت <strong>{range.price ?? "استعلام قیمت"}</strong></span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </> : !loading && (!slug || failed || ranges !== null) && <Link className={styles.dateLink} href={href}>مشاهده جزئیات تور ←</Link>}
      </div>
    </details>
  );
}

function getNightCount(range: Range) {
  if (typeof range.nights === "number" && Number.isInteger(range.nights) && range.nights >= 0) return range.nights;
  if (!range.returnDate) return null;
  const nights = (Date.parse(range.returnDate) - Date.parse(range.departureDate)) / 86400000;
  return Number.isInteger(nights) && nights >= 0 ? nights : null;
}
