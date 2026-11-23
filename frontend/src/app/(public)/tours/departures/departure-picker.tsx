"use client";

import { useRouter } from "next/navigation";
import { DeparturePicker } from "@/components/content/departure-picker";
import { formatPersianDate } from "@/lib/persian-date";
import type { Departure } from "./catalog";

export function AvinaDeparturePicker({ tours, selected }: { tours: Departure[]; selected: Departure }) {
  const router = useRouter();
  const options = tours.map((tour, id) => {
    const prices = tour.rates.filter(rate => rate.kind === "double" || rate.kind === "single")
      .map(rate => rate.total).filter(parts => parts.length === 1).map(parts => parts[0]);
    const currency = prices[0]?.currencyCode || "IRR";
    const amounts = prices.filter(price => price.currencyCode === currency)
      .map(price => Number(price.amount)).filter(amount => Number.isFinite(amount) && amount > 0);
    return {
      id, departureDate: tour.startsOn, label: tour.title, currency,
      nights: Math.round((Date.parse(tour.endsOn) - Date.parse(tour.startsOn)) / 86400000),
      priceAmount: amounts.length ? String(Math.min(...amounts)) : null,
    };
  });
  const current = options[tours.findIndex(tour => tour.startsOn === selected.startsOn && tour.endsOn === selected.endsOn)];
  return <div className="space-y-3">
    {current && <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
      <span className="text-muted">پکیج انتخابی</span>
      <strong>{formatPersianDate(current.departureDate)}</strong>
      <span>· {current.nights.toLocaleString("fa-IR")} شب</span>
    </div>}
    <aside className="rounded-2xl border border-border bg-white p-3 text-center">
      <h2 className="font-black text-brand">روزهای برگزاری تور</h2>
      <DeparturePicker plain options={options} selected={current} available={() => true}
        onSelect={id => router.push(`/tours/departures/${encodeURIComponent(tours[id].id)}/#${tours[id].hotels.length ? "tour-booking" : "tour-dates"}`)} />
    </aside>
  </div>;
}
