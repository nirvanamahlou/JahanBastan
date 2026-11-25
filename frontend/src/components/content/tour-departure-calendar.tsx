"use client";

import { type ReactNode, useEffect, useState } from "react";

import { formatCurrency } from "@/lib/currency";
import { DeparturePicker } from "./departure-picker";
import { formatPersianDate } from "@/lib/persian-date";
import { setTourDepartureUrl, isTourDepartureBookable, tourDepartureUnavailableLabel, type TourDepartureAvailability } from "@/lib/tour-departure-availability";

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
  const selectedDeparture = selectedDepartureId === null ? bookableDates[0] : dates.find((departure) => departure.id === selectedDepartureId && isTourDepartureBookable(departure));

  useEffect(() => {
    const sync = (event: Event) => setSelectedDepartureId((event as CustomEvent<{ departureId: number }>).detail.departureId);
    window.addEventListener("tour-hotels-duration-selected", sync);
    return () => window.removeEventListener("tour-hotels-duration-selected", sync);
  }, []);

  function selectDeparture(departureId: number) {
    const departure = bookableDates.find((date) => date.id === departureId);
    if (!departure) return;
    setSelectedDepartureId(departureId);
    setTourDepartureUrl(departureId, "#tour-dates");
    window.dispatchEvent(
      new CustomEvent("tour-departure-selected", { detail: { departureId, showHotels: Boolean(departure.canBook) } }),
    );
  }

  if (!dates.length) {
    return (
      <section className="mx-auto w-full max-w-[48rem] rounded-2xl border border-dashed border-border bg-white p-4 text-center" id="tour-dates">
        <h2 className="text-xl font-black text-brand">تاریخ‌های برگزاری</h2>
        <p className="mt-2 text-sm text-muted">هنوز تاریخی برای برگزاری این تور ثبت نشده است.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[48rem] scroll-mt-24 rounded-2xl border border-border bg-white p-3 sm:p-4" id="tour-dates">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-brand sm:text-lg">تاریخ و مدت اقامت</h2>
        </div>
        <p className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
          {new Set(bookableDates.map(item => item.departureDate ?? item.id)).size.toLocaleString("fa-IR")} تاریخ فعال
        </p>
      </div>

      {dates.some((d, index) => d.departureDate && dates.slice(0, index).some(other => other.departureDate === d.departureDate)) ? (
      <DeparturePicker options={dates} selected={selectedDeparture} available={isTourDepartureBookable} onSelect={selectDeparture} />
      ) : (
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="فهرست تاریخ‌های برگزاری تور">
        {dates.map((departure, index) => {
          const bookable = isTourDepartureBookable(departure);
          return (
          <li key={departure.id}>
            <button
              aria-pressed={selectedDeparture?.id === departure.id}
              aria-controls="selected-departure-flights"
              className={`group flex h-full min-h-12 w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl border px-2.5 py-2 text-right transition enabled:hover:border-brand disabled:cursor-not-allowed disabled:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selectedDeparture?.id === departure.id ? "border-brand bg-brand/5" : "border-border bg-background"}`}
              disabled={!bookable}
              onClick={() => selectDeparture(departure.id)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-xs font-black text-brand group-aria-pressed:bg-brand group-aria-pressed:text-white">{(index + 1).toLocaleString("fa-IR")}</span>
                <span className={`min-w-0 ${bookable ? "" : "line-through decoration-2"}`}>
                  <span className="block break-words text-xs font-black text-brand">{departure.label}</span>
                  {departure.departureDate ? <time className="mt-1 block text-sm text-muted" dateTime={departure.departureDate}>{formatPersianDate(departure.departureDate)}</time> : <span className="mt-1 block text-sm text-muted">تاریخ اعلام می‌شود</span>}
                </span>
              </span>
              {!bookable ? <span className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">{tourDepartureUnavailableLabel(departure)}</span> : departure.priceAmount ? <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand">شروع از {formatCurrency(departure.priceAmount, departure.currency)}</span> : <span className="text-xs font-bold text-muted">مشاهده اطلاعات پرواز</span>}
            </button>
          </li>
          );
        })}
      </ul>
      )}
      {selectedDepartureId !== null && !selectedDeparture && bookableDates.length > 0 && <p role="status" className="mt-3 text-sm text-muted">تاریخ انتخاب‌شده قابل رزرو نیست. یک تاریخ دیگر انتخاب کنید.</p>}
      {!bookableDates.length ? <p className="mt-5 rounded-xl bg-surface-muted p-4 text-sm font-bold text-muted" role="status">در حال حاضر هیچ تاریخ قابل رزروی برای این تور وجود ندارد.</p> : null}
      {selectedDeparture ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3" id="selected-departure-flights" role="region" aria-label={`پروازهای ${selectedDeparture.departureDate ? formatPersianDate(selectedDeparture.departureDate) : selectedDeparture.label}`}>
          {selectedDeparture.flightDetails ?? <p className="rounded-2xl bg-surface-muted p-4 text-sm text-muted">اطلاعات پرواز برای این نوبت هنوز ثبت نشده است.</p>}
        </div>
      ) : null}
    </section>
  );
}
