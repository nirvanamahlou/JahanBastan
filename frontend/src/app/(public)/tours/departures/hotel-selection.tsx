"use client";

import { SiteSelect } from "@/components/ui/site-select";
import { SearchIcon } from "@/components/layout/site-icons";
import { toToman, type ExchangeRates } from "@/lib/currency-conversion";
import { useState } from "react";
import { HotelAmenities } from "@/components/content/hotel-amenities";
import { HotelLocationMap } from "@/components/content/hotel-location-map";
import { TourHotelPresentation } from "@/components/content/tour-hotel-presentation";
import hotelStyles from "@/components/content/tour-hotel-presentation.module.css";
import { hotelImages, labels, priceText, type Departure } from "./catalog";

const normalize = (value: string) => value.trim().toLocaleLowerCase("fa-IR")
  .replace(/ي/g, "ی").replace(/ك/g, "ک");
const field = "w-full rounded-xl border border-border bg-white p-3 text-sm";

function HotelRates({ rates, hotelName }: { rates: Departure["rates"]; hotelName: string }) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const totals = new Map<string, number>();
  for (const [index, rate] of rates.entries()) {
    const passengers = (counts[index] || 0) * (rate.kind === "double" ? 2 : 1);
    if (!passengers) continue;
    for (const price of rate.total) {
      totals.set(price.currencyCode, (totals.get(price.currencyCode) || 0) + Number(price.amount) * passengers);
    }
  }
  if (!rates.length) return <p className="text-sm text-muted">نرخ این هتل اعلام نشده است.</p>;
  const choices = rates.map((rate, index) => {
    const count = counts[index] || 0;
    const double = rate.kind === "double";
    const room = double ? "اتاق دوتخته (۲ نفر)" : rate.kind === "single" ? "اتاق یک‌تخته" : labels[rate.kind] || rate.kind;
    const priced = rate.total.length > 0 && rate.total.every(part => Number.isFinite(Number(part.amount)));
    return { rate, index, count, double, room, priced };
  });
  const pricedChoices = choices.filter(choice => choice.priced);
  return <>
    <div className={hotelStyles.rateGrid} aria-label="نرخ‌های اتاق و مسافر">
      {choices.map(({ rate, index, count, double, room, priced }) => (
        <div key={index} className={hotelStyles.rateTile} data-primary={double && priced} data-active={count > 0} data-unavailable={!priced}>
          <p className={hotelStyles.rateLabel}>{room}</p>
          {rate.roomTypeName && <p className={hotelStyles.rateMeta}>{rate.roomTypeName}</p>}
          <div className={hotelStyles.ratePrice}>
            <strong>{priced ? priceText(rate.total) : "استعلام قیمت"}</strong>
            {(rate.hotel.length > 0 || rate.flight.length > 0) && <span className="text-muted">
              {[rate.hotel.length ? "هتل " + priceText(rate.hotel) : "", rate.flight.length ? "پرواز " + priceText(rate.flight) : ""].filter(Boolean).join(" + ")}
            </span>}
          </div>
        </div>
      ))}
    </div>
    {pricedChoices.length > 0 && <details className={`${hotelStyles.booking} mt-2 !mx-0 !mb-0`}>
      <summary>محاسبه مبلغ سفر</summary>
      <div className={hotelStyles.bookingBody}>
        <div className={hotelStyles.rateGrid}>
          {pricedChoices.map(({ rate, index, count, double, room }) => {
            const label = [room, rate.roomTypeName, hotelName].filter(Boolean).join("، ");
            const adjust = (delta: number) => setCounts(current => ({
              ...current, [index]: Math.max(0, Math.min(20, (current[index] || 0) + delta)),
            }));
            return <div key={index} className={hotelStyles.rateTile} data-active={count > 0}>
              <p className={hotelStyles.rateLabel}>{[room, rate.roomTypeName].filter(Boolean).join("، ")}</p>
              <div className={hotelStyles.rateControl}>
                <button type="button" aria-label={"کم کردن " + label} onClick={() => adjust(-1)} disabled={!count} className="disabled:opacity-35">−</button>
                <output aria-label={"تعداد مسافران " + label}>{(count * (double ? 2 : 1)).toLocaleString("fa-IR")}</output>
                <button type="button" aria-label={"افزودن " + label} onClick={() => adjust(1)} disabled={count >= 20} className="disabled:opacity-35">+</button>
              </div>
            </div>;
          })}
        </div>
        {totals.size > 0 && <output aria-live="polite" className="block rounded-xl bg-[#fff0f6] p-3 font-bold text-brand">
          جمع انتخاب‌ها {priceText([...totals].map(([currencyCode, amount]) => ({ currencyCode, amount: String(amount) })))}
        </output>}
      </div>
    </details>}
  </>;
}

export function AvinaHotelSelection({ tour, exchangeRates }: { tour: Departure; exchangeRates: ExchangeRates }) {
  const [query, setQuery] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [region, setRegion] = useState("");
  const [stars, setStars] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [installmentOnly, setInstallmentOnly] = useState(false);
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const canSell = !tour.salesStopped && !tour.previewOnly && (tour.remainingCapacity ?? 1) > 0;
  const hasInstallmentTerms = Boolean(tour.details?.installmentTerms?.trim());
  const pricedHotels = new Map<string, number>();
  for (const rate of tour.rates) {
    if ((rate.kind !== "double" && rate.kind !== "single") || !rate.total.length) continue;
    const parts = rate.total.map(price => toToman(price.amount, price.currencyCode, exchangeRates));
    if (parts.some(part => part === null || part < 0)) continue;
    const total = parts.reduce<number>((sum, part) => sum + (part ?? 0), 0);
    if (total > 0) pricedHotels.set(rate.hotelId, Math.min(total, pricedHotels.get(rate.hotelId) ?? total));
  }
  const location = (hotel: Departure["hotels"][number]) => hotel.region || hotel.city?.name || "";
  const regions = [...new Set(tour.hotels.map(location).filter(Boolean))];
  const visible = tour.hotels.filter(hotel => {
    const price = pricedHotels.get(hotel.id);
    return normalize([hotel.name, hotel.englishName].filter(Boolean).join(" ")).includes(normalize(query)) &&
      (!hotelId || hotel.id === hotelId) && (!region || location(hotel) === region) &&
      (!stars || String(hotel.starRating) === stars) &&
      (!availableOnly || (canSell && tour.rates.some(rate => rate.hotelId === hotel.id && rate.total.length > 0 && (rate.kind === "single" || rate.kind === "double")))) &&
      (!installmentOnly || hasInstallmentTerms) &&
      ((!minimum && !maximum) || (price !== undefined &&
        (!minimum || price >= Number(minimum)) && (!maximum || price <= Number(maximum))));
  });
  return <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <aside className="h-fit rounded-[1.75rem] border border-[#ffd1e3] bg-gradient-to-b from-white to-[#fff6fa] p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
      <header className="flex items-center justify-between border-b border-[#ffd7e6] pb-4">
        <h2 className="flex items-center gap-2 font-black text-brand"><span aria-hidden="true" className="grid size-8 place-items-center rounded-xl bg-[#ffe3ee] text-[#f12b75]">☷</span>فیلترها</h2>
        <button type="button" className="rounded-lg bg-[#fff0f6] px-2 py-1 text-xs font-bold text-[#e6236c]" onClick={() => { setQuery(""); setHotelId(""); setRegion(""); setStars(""); setAvailableOnly(false); setInstallmentOnly(false); setMinimum(""); setMaximum(""); }}>پاک کردن</button>
      </header>
      <div className="mt-4 grid gap-3 text-sm font-bold text-brand">
        <label className="grid gap-2">جستجوی نام هتل
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-[#e6236c]" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="نام هتل را وارد کنید" className={field + " pe-9"} />
          </span>
        </label>
        <div className="grid gap-2">هتل<SiteSelect ariaLabel="هتل" id="avina-hotel-filter" searchable
          value={hotelId || "all"} onValueChange={value => setHotelId(value === "all" ? "" : value)}
          options={[{ value: "all", label: "همه هتل‌ها" }, ...tour.hotels.map(hotel => ({ value: hotel.id, label: hotel.name }))]} /></div>
        <div className="grid gap-2">منطقه یا شهر هتل<SiteSelect ariaLabel="منطقه یا شهر هتل" id="avina-hotel-region"
          value={region || "all"} onValueChange={value => setRegion(value === "all" ? "" : value)}
          options={[{ value: "all", label: "همه مناطق" }, ...regions.map(name => ({ value: name, label: name }))]} /></div>
        <fieldset className="grid gap-2 border-t border-[#ffd7e6] pt-2">
          <legend>درجه هتل</legend>
          {["", "5", "4", "3", "2", "1"].map(value => <button type="button" key={value} aria-pressed={stars === value} onClick={() => setStars(value)} className="flex justify-between rounded-xl border border-[#ffe0ec] bg-white p-2 aria-pressed:border-[#f12b75] aria-pressed:bg-[#fff0f6]">
            <span>{value ? Number(value).toLocaleString("fa-IR") + " ستاره" : "همه هتل‌ها"}</span><span aria-hidden="true" className="text-[#e6236c]">{"★".repeat(Number(value) || 5)}</span>
          </button>)}
        </fieldset>
        <fieldset className="grid gap-2 border-t border-[#ffd7e6] pt-2">
          <legend>فیلترهای تور</legend>
          <label className="flex items-center justify-between gap-2 rounded-xl border border-[#ffe0ec] bg-white p-3">
            فقط تورهای موجود<input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} className="size-5 accent-[#f12b75]" />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-xl border border-[#ffe0ec] bg-white p-3">
            دارای شرایط اقساط<input type="checkbox" checked={installmentOnly} onChange={event => setInstallmentOnly(event.target.checked)} className="size-5 accent-[#f12b75]" />
          </label>
        </fieldset>
        <fieldset className="grid gap-2 border-t border-[#ffd7e6] pt-2">
          <legend>بازه قیمت نهایی هر نفر (تومان)</legend>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} inputMode="numeric" aria-label="حداقل قیمت به تومان" placeholder="از" value={minimum} onChange={event => setMinimum(event.target.value)} className={field} />
            <input type="number" min={0} inputMode="numeric" aria-label="حداکثر قیمت به تومان" placeholder="تا" value={maximum} onChange={event => setMaximum(event.target.value)} className={field} />
          </div>
        </fieldset>
      </div>
    </aside>
    <div className="min-w-0 space-y-4" id="avina-tour-hotel-results">
      {visible.map(hotel => {
        const facilities = hotel.facilities.map(item => item.facility.name).join("، ");
        const city = hotel.city?.name ?? tour.outbound.destinationName;
        return <article key={hotel.id} className="min-w-0 overflow-hidden rounded-[1.75rem] border border-[#ffd1e3] bg-white shadow-[0_16px_40px_rgba(241,43,117,.10)]">
          <TourHotelPresentation name={hotel.name} images={hotelImages(hotel)}
            href={hotel.profileSlug ? "/hotels/" + encodeURIComponent(hotel.profileSlug) + "/" : undefined}
            location={[city, hotel.city?.country.name].filter(Boolean).join("، ")}
            stars={hotel.starRating} summary={hotel.description} facilities={facilities}
            badges={tour.previewOnly ? <span className="rounded-xl bg-surface-muted px-3 py-2 text-xs font-bold">پیش‌نمایش</span> : null}
            amenities={<HotelAmenities description={facilities} region={hotel.region ?? null} roomType="" serviceType={hotel.serviceLevel || ""} variant="tour-card" />}
            rates={<HotelRates rates={tour.rates.filter(rate => rate.hotelId === hotel.id)} hotelName={hotel.name} />}
            locationMap={<HotelLocationMap compact name={hotel.englishName || hotel.name} address={hotel.address} region={hotel.region}
              destination={city} country={hotel.city?.country.name} latitude={hotel.latitude} longitude={hotel.longitude} />} />
        </article>;
      })}
      {!visible.length && <p role="status" className="rounded-xl border p-5 text-muted">هتلی با این فیلترها پیدا نشد.</p>}
    </div>
  </div>;
}
