"use client";

import { useEffect, useState } from "react";
import { CombinedPackageCard } from "@/components/content/combined-package-card";
import { SiteSelect } from "@/components/ui/site-select";
import { isTourDepartureBookable, setTourDepartureUrl, tourDepartureUnavailableLabel, tourReturnDate } from "@/lib/tour-departure-availability";
import { formatPersianDate } from "@/lib/persian-date";
import type { PublicCombinedPackage } from "@/types/combined-pricing";
import type { ExchangeRates } from "@/lib/currency-conversion";

type Departure = { id: number; label: string; returnDate?: string | null; nights?: number | null; departureDate: string | null; bookingStatus: string; capacityRemaining: number | null };

function useCombinedDeparture(departures: Departure[], packages: PublicCombinedPackage[], initialDepartureId?: number) {
  const dates = [...departures].filter((item) => item.departureDate).sort((a, b) => (a.departureDate ?? "").localeCompare(b.departureDate ?? ""));
  const hasDatedPrices = packages.some((item) => item.departurePrices?.length);
  const initial = dates.find((date) => packages.some((item) => item.departurePrices?.some((price) => price.departureId === date.id))) ?? dates[0];
  const [selectedId, setSelectedId] = useState<number | null>(initialDepartureId ?? null);
  const selected = selectedId === null ? initial : dates.find((item) => item.id === selectedId);
  useEffect(() => {
    const onDeparture = (event: Event) => {
      const id = (event as CustomEvent<{ departureId?: number }>).detail?.departureId;
      if (id !== undefined) setSelectedId(id);
    };
    window.addEventListener("tour-departure-selected", onDeparture);
    window.addEventListener("tour-hotels-duration-selected", onDeparture);
    return () => {
      window.removeEventListener("tour-departure-selected", onDeparture);
      window.removeEventListener("tour-hotels-duration-selected", onDeparture);
    };
  }, []);
  return { dates, selected, hasDatedPrices };
}

export function CombinedDepartureSelect({ departures, packages, initialDepartureId }: {
  departures: Departure[];
  packages: PublicCombinedPackage[];
  initialDepartureId?: number;
}) {
  const { dates, selected } = useCombinedDeparture(departures, packages, initialDepartureId);
  return (
    dates.length ? <div className="grid min-w-0 gap-0.5">
        <p className="text-xs font-bold text-brand">تاریخ برگزاری</p>
        <SiteSelect
          ariaLabel="تاریخ برگزاری"
          cardOptions
          compactMenu
          className="min-h-9! rounded-lg! text-xs!"
          id="combined-tour-departure"
          onValueChange={(value) => {
            const departureId = Number(value);
            setTourDepartureUrl(departureId);
            window.dispatchEvent(new CustomEvent("tour-hotels-duration-selected", { detail: { departureId } }));
          }}
          options={dates.map(item => {
            const start = item.departureDate ? formatPersianDate(item.departureDate) : item.label;
            const end = item.departureDate ? tourReturnDate(item.departureDate, item.returnDate ?? null, item.nights) : null;
            const label = end ? `${start} تا ${formatPersianDate(end)}` : start;
            const nights = item.nights != null ? `${item.nights.toLocaleString("fa-IR")} شب` : null;
            const status = isTourDepartureBookable(item) ? "قابل رزرو" : tourDepartureUnavailableLabel(item);
            return { label, description: [nights, status].filter(Boolean).join(" · "), value: String(item.id) };
          })}
          placeholder="تاریخ انتخاب‌شده موجود نیست"
          value={selected ? String(selected.id) : ""}
        />
      </div> : null
  );
}

export function DatedCombinedPackages({ packages, departures, country, standaloneHotels = false, tourId, exchangeRates, initialDepartureId }: {
  packages: PublicCombinedPackage[];
  country?: string | null;
  departures: Departure[];
  standaloneHotels?: boolean;
  tourId: number;
  exchangeRates: ExchangeRates;
  initialDepartureId?: number;
}) {
  const { selected, hasDatedPrices } = useCombinedDeparture(departures, packages, initialDepartureId);
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
      {closed ? <p className="rounded-xl bg-amber-50 p-3 font-bold text-amber-900" role="status">این تاریخ در حال حاضر قابل رزرو نیست.</p> : null}
      {offers.length ? offers.map((item, index) => <CombinedPackageCard country={country} lastTravelDay={selected?.departureDate ? tourReturnDate(selected.departureDate, selected.returnDate ?? null, selected.nights) ?? selected.departureDate : null} bookingDisabled={Boolean(closed)} capacityRemaining={selected?.capacityRemaining ?? null} departureId={selected?.id ?? null} exchangeRates={exchangeRates} item={item} key={`${item.id ?? index}-${item.combinedDeparturePriceId ?? "base"}`} tourId={tourId} />) : <p className="py-6 text-center text-muted">قیمت ترکیب‌ها برای این تاریخ هنوز ثبت نشده است.</p>}
    </section>
  );
}
