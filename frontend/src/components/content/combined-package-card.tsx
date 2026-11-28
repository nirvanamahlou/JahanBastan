"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { CombinedTourCheckout } from "@/components/checkout/combined-tour-checkout";
import { useOnlineSalesEnabled } from "@/components/online-sales-provider";
import { isFinalLocalTourPrice } from "@/lib/tour-price-currency";
import { formatCurrency } from "@/lib/currency";
import { TourPriceBreakdown } from "./tour-price-breakdown";
import { summarizeTourPrice, type ExchangeRates } from "@/lib/currency-conversion";
import { BedIcon } from "@/components/layout/site-icons";
import { HotelStars } from "@/components/content/hotel-stars";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import type { PublicCombinedPackage as CombinedPackage } from "@/types/combined-pricing";

function CombinedPackagePrice({
  label,
  price,
  currency,
  addFlight,
  flightPrice,
  flightCurrency,
  children,
}: {
  label: string;
  price: string;
  currency: string;
  addFlight: boolean;
  flightPrice: string | null;
  flightCurrency: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-white p-1.5 text-center">
      <p className="text-xs text-muted">{label}</p>
      <strong className="mb-1 mt-0.5 flex min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-xs leading-snug text-brand">
        <bdi className="whitespace-nowrap">{formatCurrency(price, currency)}</bdi>
        {addFlight && flightPrice !== null && Number(flightPrice) > 0 && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span>+</span>
            <bdi>{formatCurrency(flightPrice, flightCurrency)}</bdi>
          </span>
        )}
      </strong>
      {children}
    </div>
  );
}

type SelectionKey = "double" | "single" | "extra" | "childWithBed" | "childWithoutBed" | "infant";
type Selection = Record<SelectionKey, number>;
const emptySelection: Selection = { double: 0, single: 0, extra: 0, childWithBed: 0, childWithoutBed: 0, infant: 0 };

export function CombinedPackageCard({ item, tourId, departureId, capacityRemaining, bookingDisabled, exchangeRates, country, lastTravelDay }: {
  item: CombinedPackage;
  country?: string | null;
  lastTravelDay?: string | null;
  tourId?: number;
  departureId?: number | null;
  capacityRemaining?: number | null;
  bookingDisabled?: boolean;
  exchangeRates?: ExchangeRates;
}) {
  const onlineSalesEnabled = useOnlineSalesEnabled();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const childFlightPrice = item.childWithBedFlightPrice ?? item.childWithoutBedFlightPrice ?? null;
  const childFlightCurrency = item.childWithBedFlightCurrency ?? item.childWithoutBedFlightCurrency;
  const childWithoutBedFlightPrice = item.childWithoutBedCurrency === "IRT" ? null : childFlightPrice;
  const prices = [
    ["double", "دوتخته", item.doublePrice, item.doubleCurrency, item.addFlightToDouble, item.doubleFlightPrice ?? item.regularFlightPrice, item.regularFlightCurrency],
    ["single", "یک‌تخته", item.singlePrice, item.singleCurrency, item.addFlightToSingle, item.singleFlightPrice ?? item.regularFlightPrice, item.regularFlightCurrency],
    ...(Number(item.extraPrice) > 0 ? [["extra", "تخت اضافه", item.extraPrice ?? null, item.extraCurrency ?? "IRT", true, item.regularFlightPrice, item.regularFlightCurrency] as const] : []),
    ["childWithBed", "کودک با تخت", item.childWithBedPrice, item.childWithBedCurrency, item.addFlightToChildWithBed && !isFinalLocalTourPrice(item.childWithBedCurrency), item.childWithBedFlightPrice ?? null, item.childWithBedFlightCurrency ?? "IRT"],
    ["childWithoutBed", "کودک بدون تخت", item.childWithoutBedPrice, item.childWithoutBedCurrency, item.addFlightToChildWithoutBed, childWithoutBedFlightPrice, childFlightCurrency],
    ["infant", "نوزاد", item.infantPrice, item.infantCurrency, Number(item.infantSupplementPrice) > 0, item.infantSupplementPrice ?? null, item.infantSupplementCurrency ?? "IRT"],
  ] as const;
  const availablePrices = prices.filter(([, , price]) => price !== null && Number(price) > 0);
  const selectedCount = Object.values(selection).reduce((sum, count) => sum + count, 0);
  const passengerCount = selection.double * 2 + selection.single + selection.extra + selection.childWithBed + selection.childWithoutBed + selection.infant;
  const priceSummary = summarizeTourPrice(prices.flatMap(([key, , amount, currency, addFlight, flightPrice, flightCurrency]) => {
    const quantity = selection[key] * (key === "double" ? 2 : 1);
    const parts = [{ amount, currency, quantity }];
    if (addFlight && Number(flightPrice) > 0) parts.push({ amount: flightPrice, currency: flightCurrency, quantity });
    return parts;
  }), exchangeRates ?? {});
  const canPurchase = Boolean(tourId && departureId && item.combinedDeparturePriceId);
  const requiresFlightQuote = canPurchase && item.regularFlightPrice === null;
  const capacityExceeded = capacityRemaining !== null && capacityRemaining !== undefined && passengerCount > capacityRemaining;
  const updateSelection = (key: SelectionKey, delta: number) => setSelection((current) => ({ ...current, [key]: Math.max(0, Math.min(20, current[key] + delta)) }));
  return (
    <article className="mx-auto w-full max-w-[880px] overflow-hidden rounded-xl border border-border bg-surface-muted shadow-sm">
      <div className="grid grid-cols-2 gap-2 p-2">
        {item.hotels.map((assignment, hotelIndex) => {
          const images = [assignment.hotel.imageId, ...assignment.hotel.galleryImageIds].filter(
            (imageId, imageIndex, imageIds): imageId is number => Boolean(imageId) && imageIds.indexOf(imageId) === imageIndex,
          );
          const cover = images[0] ?? null;
          const board = assignment.boardType?.trim();
          const roomType = assignment.roomType?.trim();
          return (
            <article className={`overflow-hidden rounded-xl border border-border bg-white ${item.hotels.length === 3 && hotelIndex === 2 ? "col-span-2" : ""}`} key={`${assignment.hotel.slug}-${hotelIndex}`}>
              <Link aria-label={`مشاهده جزئیات ${assignment.hotel.name}`} className="group block" href={`/hotels/${assignment.hotel.slug}/`}>
                <div className="relative h-[68px] sm:h-[88px] overflow-hidden bg-surface-muted">
                  {cover ? <Image alt={`نمای ساختمان هتل ${assignment.hotel.name}`} className="object-cover transition duration-500 group-hover:scale-105" fill sizes="(max-width: 768px) 48vw, 550px" src={`${PUBLIC_API_BASE_URL}/media/${cover}`} /> : <span className="grid h-full place-items-center text-sm text-muted">بدون تصویر</span>}
                  <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-xl bg-brand/90 font-black text-white shadow-lg">{(hotelIndex + 1).toLocaleString("fa-IR")}</span>
                  {images.length > 1 ? <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-black text-white backdrop-blur">{images.length.toLocaleString("fa-IR")} تصویر</span> : null}
                </div>
                <div className="p-2">
                  <div className="flex flex-wrap items-start justify-between gap-1">
                    <div className="min-w-0">
                      <strong className="block break-words text-xs sm:text-sm text-brand transition group-hover:text-accent-strong">{assignment.hotel.name}</strong>
                    </div>
                    <HotelStars className="shrink-0" rating={assignment.hotel.starRating} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-brand">
                    <span className="shrink-0 text-xs text-muted">{assignment.nights.toLocaleString("fa-IR")} شب</span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-1.5 py-0.5">
                      <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3v4a3 3 0 0 0 6 0V3M7 3v18m10 0V3c4 2 4 7 0 8" /></svg>
                      <span className="sr-only">سرویس </span><b>{board || "اعلام نشده"}</b>
                    </span>
                    {roomType && <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-1.5 py-0.5">
                      <BedIcon aria-hidden="true" className="size-4 shrink-0" />
                      نوع اتاق <b>{roomType}</b>
                    </span>}
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
      {availablePrices.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2 border-t border-border p-2.5">
        {availablePrices.map(([key, label, price, currency, addFlight, flightPrice, flightCurrency]) => (
          <CombinedPackagePrice key={key} addFlight={addFlight} currency={currency} flightCurrency={flightCurrency}
            flightPrice={flightPrice} label={label} price={price ?? ""}>
            {canPurchase ? <div className="mx-auto mt-auto flex w-full max-w-28 items-center overflow-hidden rounded-md border border-border bg-surface-muted">
              <button aria-label={`کم کردن ${label}`} className="grid h-8 min-w-0 flex-1 place-items-center font-bold text-brand disabled:opacity-35" disabled={selection[key] === 0} onClick={() => updateSelection(key, -1)} type="button">−</button>
              <output className="grid h-8 w-8 place-items-center border-x border-border text-xs font-bold text-brand">{(key === "double" ? selection[key] * 2 : selection[key]).toLocaleString("fa-IR")}</output>
              <button aria-label={`افزودن ${label}`} className="grid h-8 min-w-0 flex-1 place-items-center font-bold text-brand disabled:opacity-35" disabled={passengerCount + (key === "double" ? 2 : 1) > 20} onClick={() => updateSelection(key, 1)} type="button">+</button>
            </div> : null}
          </CombinedPackagePrice>
        ))}
      </div> : null}
      {requiresFlightQuote ? <div className="border-t border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950" role="status">
        <p className="font-black">قیمت‌های نمایش‌داده‌شده شامل نرخ پرواز نیستند؛ نرخ پرواز پس از اخذ ویزا اعلام و در لحظه صادر می‌شود.</p>
        <p>برای دریافت قیمت نهایی و ثبت درخواست با کارشناسان ما تماس بگیرید.</p>
        <Link className="mt-3 inline-flex rounded-xl bg-brand px-4 py-2 font-black text-white" href="/contact/">تماس با کارشناسان</Link>
      </div> : null}
      {canPurchase && selectedCount > 0 && !requiresFlightQuote ? <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-white p-2.5">
        <TourPriceBreakdown compact summary={priceSummary} />
        <button className="account-primary min-h-10 rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50" disabled={!onlineSalesEnabled || bookingDisabled || capacityExceeded} onClick={() => setCheckoutOpen(true)} type="button">
          {!onlineSalesEnabled ? "تماس حاصل فرمایید" : bookingDisabled ? "این تاریخ قابل رزرو نیست" : capacityExceeded ? "ظرفیت کافی نیست" : "خرید و ادامه ورود اطلاعات مسافران"}
        </button>
      </div> : null}
      {checkoutOpen && tourId && departureId && item.combinedDeparturePriceId ? (
        <CombinedTourCheckout hotelSummary={item.hotels.map(row => [row.hotel.name, row.roomType].filter(Boolean).join(" · ")).join("، ")} country={country} lastTravelDay={lastTravelDay} priceSummary={priceSummary} combinedDeparturePriceId={item.combinedDeparturePriceId} departureId={departureId}
          onClose={() => setCheckoutOpen(false)} roomSelection={selection} tourId={tourId} />
      ) : null}
    </article>
  );
}
