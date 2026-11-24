"use client";

import { type ReactNode, useEffect, useState } from "react";

import { formatCurrency } from "@/lib/currency";
import { DeparturePicker } from "./departure-picker";
import { formatPersianDate } from "@/lib/persian-date";
import { isTourDepartureBookable, tourDepartureUnavailableLabel, type TourDepartureAvailability } from "@/lib/tour-departure-availability";

export type TourDepartureCalendarItem = TourDepartureAvailability & {
  id: number;
  label: string;
  departureDate: string | null;
  priceAmount: string | null;
  currency: string;
  nights?: number | null;
  flightDetails?: ReactNode;
  canBook?: boolean;
};

export function TourDepartureCalendar({
  departures,
  fallbackDate,
  initialDepartureId,
}: {
  departures: TourDepartureCalendarItem[];
  fallbackDate?: string | null;
  initialDepartureId?: number;
}) {
  const [selectedDepartureId, setSelectedDepartureId] = useState<number | null>(initialDepartureId ?? null);
  const available = [...departures]
    .filter((item) => item.departureDate || item.flightDetails)
    .sort((a, b) => (a.departureDate ?? "").localeCompare(b.departureDate ?? ""));
  const fallback: TourDepartureCalendarItem[] = fallbackDate
    ? [{ id: -1, label: "تاریخ اصلی تور", departureDate: fallbackDate, priceAmount: null, currency: "IRT", bookingStatus: "open", capacityRemaining: null }]
    : [];
  const dates = available.length ? available : fallback;
  const bookableDates = dates.filter(isTourDepartureBookable);
  const selectedDeparture = dates.find((departure) => departure.id === selectedDepartureId) ?? bookableDates[0];

  useEffect(() => {
    const sync = (event: Event) => setSelectedDepartureId((event as CustomEvent<{ departureId: number }>).detail.departureId);
    window.addEventListener("tour-hotels-duration-selected", sync);
    return () => window.removeEventListener("tour-hotels-duration-selected", sync);
  }, []);

  function selectDeparture(departureId: number, showHotels = false) {
    if (!bookableDates.some((departure) => departure.id === departureId)) return;
    setSelectedDepartureId(departureId);
    window.history.replaceState(null, "", showHotels ? "#tour-booking" : "#tour-dates");
    window.dispatchEvent(
      new CustomEvent("tour-departure-selected", { detail: { departureId, showHotels } }),
    );
  }

  if (!dates.length) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-white p-8 text-center" id="tour-dates">
        <h2 className="text-xl font-black text-brand">تاریخ‌های برگزاری</h2>
        <p className="mt-2 text-sm text-muted">هنوز تاریخی برای برگزاری این تور ثبت نشده است.</p>
      </section>
    );
  }

  return (
    <section className="scroll-mt-24 rounded-3xl border border-border bg-surface p-4 shadow-[0_16px_44px_rgba(1,37,105,0.09)] sm:p-6" id="tour-dates">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">تاریخ و مدت اقامت</h2>
        </div>
        <p className="rounded-full border border-accent bg-surface-muted px-3 py-1.5 text-xs font-bold text-muted">
          {new Set(bookableDates.map(item => item.departureDate ?? item.id)).size.toLocaleString("fa-IR")} تاریخ فعال
        </p>
      </div>

      {dates.some((d, index) => d.departureDate && dates.slice(0, index).some(other => other.departureDate === d.departureDate)) ? (
      <DeparturePicker options={dates} selected={selectedDeparture} available={isTourDepartureBookable} onSelect={selectDeparture} />
      ) : (
      <ul className="mt-5 grid gap-3 md:grid-cols-2" aria-label="فهرست تاریخ‌های برگزاری تور">
        {dates.map((departure, index) => {
          const bookable = isTourDepartureBookable(departure);
          return (
          <li key={departure.id}>
            <button
              aria-pressed={selectedDeparture?.id === departure.id}
              aria-controls="selected-departure-flights"
              className={`group flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 text-right shadow-[0_8px_22px_rgba(1,37,105,0.06)] transition enabled:hover:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${selectedDeparture?.id === departure.id ? "border-accent-strong bg-accent/20 ring-2 ring-accent-strong/20" : "border-border bg-background"}`}
              disabled={!bookable}
              onClick={() => selectDeparture(departure.id)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-black text-brand">{(index + 1).toLocaleString("fa-IR")}</span>
                <span className={`min-w-0 ${bookable ? "" : "line-through decoration-2"}`}>
                  <span className="block truncate font-black text-brand">{departure.label}</span>
                  {departure.departureDate ? <time className="mt-1 block text-sm text-muted" dateTime={departure.departureDate}>{formatPersianDate(departure.departureDate)}</time> : <span className="mt-1 block text-sm text-muted">تاریخ اعلام می‌شود</span>}
                </span>
              </span>
              {!bookable ? <span className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">{tourDepartureUnavailableLabel(departure)}</span> : departure.priceAmount ? <span className="rounded-xl border border-accent bg-surface-muted px-3 py-2 text-xs font-black text-brand sm:text-sm">شروع از {formatCurrency(departure.priceAmount, departure.currency)}</span> : <span className="text-xs font-bold text-muted">مشاهده اطلاعات پرواز</span>}
            </button>
          </li>
          );
        })}
      </ul>
      )}
      {!bookableDates.length ? <p className="mt-5 rounded-xl bg-surface-muted p-4 text-sm font-bold text-muted" role="status">در حال حاضر هیچ تاریخ قابل رزروی برای این تور وجود ندارد.</p> : null}
      {selectedDeparture ? (
        <div className="mt-6 space-y-4 border-t border-border pt-6" id="selected-departure-flights" role="region" aria-label={`پروازهای ${selectedDeparture.departureDate ? formatPersianDate(selectedDeparture.departureDate) : selectedDeparture.label}`}>
          {selectedDeparture.flightDetails ?? <p className="rounded-2xl bg-surface-muted p-4 text-sm text-muted">اطلاعات پرواز برای این نوبت هنوز ثبت نشده است.</p>}
          {selectedDeparture.canBook && isTourDepartureBookable(selectedDeparture) ? (
            <button className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 sm:w-auto" onClick={() => selectDeparture(selectedDeparture.id, true)} type="button">
              مشاهده هتل‌ها و قیمت‌های این تاریخ
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
