"use client";

import { type ReactNode, useEffect, useState } from "react";

import { formatPersianDate } from "@/lib/persian-date";
import { isTourDepartureBookable, type TourDepartureAvailability } from "@/lib/tour-departure-availability";

export type TourDepartureCalendarItem = TourDepartureAvailability & {
  id: number;
  label: string;
  departureDate: string | null;
  flightDetails?: ReactNode;
};

export function TourDepartureCalendar({ departures, initialDepartureId }: {
  departures: TourDepartureCalendarItem[];
  initialDepartureId?: number;
}) {
  const [selectedId, setSelectedId] = useState(initialDepartureId);
  const dates = [...departures].filter(item => item.departureDate || item.flightDetails)
    .sort((a, b) => (a.departureDate ?? "").localeCompare(b.departureDate ?? ""));
  const selected = selectedId === undefined
    ? dates.find(isTourDepartureBookable) ?? dates[0]
    : dates.find(item => item.id === selectedId);

  useEffect(() => {
    const sync = (event: Event) => setSelectedId((event as CustomEvent<{ departureId: number }>).detail.departureId);
    window.addEventListener("tour-hotels-duration-selected", sync);
    return () => window.removeEventListener("tour-hotels-duration-selected", sync);
  }, []);

  return (
    <section className="mx-auto w-full max-w-[48rem] scroll-mt-24 rounded-2xl border border-border bg-white p-3 sm:p-4" id="tour-dates" aria-label="اطلاعات پرواز">
      {selected?.flightDetails ?? <p className="text-sm text-muted">اطلاعات پرواز برای این نوبت هنوز ثبت نشده است.</p>}
    </section>
  );
}
