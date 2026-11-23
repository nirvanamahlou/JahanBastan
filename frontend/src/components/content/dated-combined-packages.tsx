"use client";

import { useEffect, useState } from "react";
import { CombinedPackageCard } from "@/components/content/combined-package-card";
import { formatPersianDate } from "@/lib/persian-date";
import type { PublicCombinedPackage } from "@/types/combined-pricing";
import type { ExchangeRates } from "@/lib/currency-conversion";

type Departure = { id: number; label: string; departureDate: string | null; bookingStatus: string; capacityRemaining: number | null };

export function DatedCombinedPackages({ packages, departures, standaloneHotels = false, tourId, exchangeRates }: {
  packages: PublicCombinedPackage[];
  departures: Departure[];
  standaloneHotels?: boolean;
  tourId: number;
  exchangeRates: ExchangeRates;
}) {
  const dates = [...departures].filter((item) => item.departureDate).sort((a, b) => (a.departureDate ?? "").localeCompare(b.departureDate ?? ""));
  const hasDatedPrices = packages.some((item) => item.departurePrices?.length);
  const initial = dates.find((date) => packages.some((item) => item.departurePrices?.some((price) => price.departureId === date.id))) ?? dates[0];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = dates.find((item) => item.id === selectedId) ?? initial;
  useEffect(() => {
    const onDeparture = (event: Event) => {
      const id = (event as CustomEvent<{ departureId?: number }>).detail?.departureId;
      if (id !== undefined) setSelectedId(id);
    };
    window.addEventListener("tour-departure-selected", onDeparture);
    return () => window.removeEventListener("tour-departure-selected", onDeparture);
  }, []);
  if (!packages.length) return null;
  const offers = packages.flatMap((item) => {
    if (!hasDatedPrices) return [item];
    const price = item.departurePrices?.find((rate) => rate.departureId === selected?.id);
    return price ? [{
      ...item,
      ...price,
      id: item.id,
      combinedDeparturePriceId: price.id,
      addFlightToDouble: true,
      addFlightToSingle: true,
      addFlightToChildWithBed: true,
      addFlightToChildWithoutBed: !["IRT", "IRR"].includes(price.childWithoutBedCurrency),
      addFlightToInfant: false,
    }] : [];
  });
  const closed = selected && (selected.bookingStatus !== "open" || selected.capacityRemaining === 0);
  return (
    <section className="space-y-5 rounded-3xl border border-violet-200 bg-white p-4 sm:p-6" id={standaloneHotels ? "tour-combined-prices" : "tour-booking"}>
      <h2 className="text-xl font-black text-brand">هتل‌ها و قیمت‌های تور ترکیبی</h2>
      <p className="text-sm leading-7 text-muted">هر قیمت برای کل اقامت در هتل‌های همان ترکیب است. هزینه پرواز فقط برای گزینه‌های دارای قیمت نمایش داده می‌شود.</p>
      {dates.length ? <label className="grid gap-2 text-sm font-bold">تاریخ برگزاری
        <select className="min-h-12 rounded-xl border border-border bg-white px-3" value={selected?.id ?? ""} onChange={(event) => setSelectedId(Number(event.target.value))}>
          {dates.map((item) => <option key={item.id} value={item.id}>{item.departureDate ? formatPersianDate(item.departureDate) : item.label}</option>)}
        </select>
      </label> : null}
      {closed ? <p className="rounded-xl bg-amber-50 p-3 font-bold text-amber-900" role="status">این تاریخ در حال حاضر قابل رزرو نیست.</p> : null}
      {offers.length ? offers.map((item, index) => <CombinedPackageCard bookingDisabled={Boolean(closed)} capacityRemaining={selected?.capacityRemaining ?? null} departureId={selected?.id ?? null} exchangeRates={exchangeRates} item={item} index={index} key={`${item.id ?? index}-${item.combinedDeparturePriceId ?? "base"}`} tourId={tourId} />) : <p className="py-6 text-center text-muted">قیمت ترکیب‌ها برای این تاریخ هنوز ثبت نشده است.</p>}
    </section>
  );
}
