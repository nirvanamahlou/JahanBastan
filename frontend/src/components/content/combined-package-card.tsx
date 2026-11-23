"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { CartAddButton } from "@/components/customer-commerce-actions";
import { isFinalLocalTourPrice } from "@/lib/tour-price-currency";
import { formatCurrency } from "@/lib/currency";
import { toToman, type ExchangeRates } from "@/lib/currency-conversion";
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
  contactOnly = false,
  supplement = false,
}: {
  label: string;
  price: string | null;
  currency: string;
  addFlight: boolean;
  flightPrice: string | null;
  flightCurrency: string;
  contactOnly?: boolean;
  supplement?: boolean;
}) {
  return (
    <div className="flex h-24 flex-col justify-center rounded-xl border border-emerald-100 bg-white p-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <strong className="mt-1 block text-sm text-brand">
        {price !== null && Number(price) > 0 ? formatCurrency(price, currency) : contactOnly ? "زیر ۲ سال: تماس با کارشناسان" : "ناموجود"}
      </strong>
      {price !== null && Number(price) > 0 && addFlight && flightPrice !== null && Number(flightPrice) > 0 ? (
        <span className="mt-1 block text-[11px] font-bold text-amber-700">
          + {supplement ? "" : "پرواز "}{formatCurrency(flightPrice, flightCurrency)}
        </span>
      ) : null}
    </div>
  );
}

type SelectionKey = "double" | "single" | "extra" | "childWithBed" | "childWithoutBed" | "infant";
type Selection = Record<SelectionKey, number>;
const emptySelection: Selection = { double: 0, single: 0, extra: 0, childWithBed: 0, childWithoutBed: 0, infant: 0 };

export function CombinedPackageCard({ item, index, tourId, departureId, capacityRemaining, bookingDisabled, exchangeRates }: {
  item: CombinedPackage;
  index: number;
  tourId?: number;
  departureId?: number | null;
  capacityRemaining?: number | null;
  bookingDisabled?: boolean;
  exchangeRates?: ExchangeRates;
}) {
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
  const selectedCount = Object.values(selection).reduce((sum, count) => sum + count, 0);
  const passengerCount = selection.double * 2 + selection.single + selection.extra + selection.childWithBed + selection.childWithoutBed + selection.infant;
  const total = prices.reduce<number | null>((sum, [key, , price, currency, addFlight, flightPrice, flightCurrency]) => {
    if (sum === null || !selection[key]) return sum;
    const hotel = toToman(price, currency, exchangeRates ?? {});
    const flight = addFlight && Number(flightPrice) > 0 ? toToman(flightPrice, flightCurrency, exchangeRates ?? {}) : 0;
    if (hotel === null || flight === null) return null;
    const factor = key === "double" ? 2 : 1;
    return sum + (hotel * factor + flight * factor) * selection[key];
  }, 0);
  const canPurchase = Boolean(tourId && departureId && item.combinedDeparturePriceId);
  const requiresFlightQuote = canPurchase && item.regularFlightPrice === null;
  const totalNights = item.hotels.reduce((sum, hotel) => sum + hotel.nights, 0);
  const capacityExceeded = capacityRemaining !== null && capacityRemaining !== undefined && passengerCount > capacityRemaining;
  const updateSelection = (key: SelectionKey, delta: number) => setSelection((current) => ({ ...current, [key]: Math.max(0, Math.min(20, current[key] + delta)) }));
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-violet-100 bg-gradient-to-b from-violet-50 to-sky-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-white/80 px-4 py-3">
        <div>
          <p className="text-xs font-black text-violet-600">ترکیب {(index + 1).toLocaleString("fa-IR")}</p>
          <h3 className="mt-1 text-lg font-black text-brand">{item.title}</h3>
        </div>
        {totalNights > 0 ? <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-700">
          {totalNights.toLocaleString("fa-IR")} شب
        </span> : null}
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {item.hotels.map((assignment, hotelIndex) => {
          const images = [assignment.hotel.imageId, ...assignment.hotel.galleryImageIds].filter(
            (imageId, imageIndex, imageIds): imageId is number => Boolean(imageId) && imageIds.indexOf(imageId) === imageIndex,
          );
          const cover = images[0] ?? null;
          return (
            <article className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm" key={`${assignment.hotel.slug}-${hotelIndex}`}>
              <Link aria-label={`مشاهده جزئیات ${assignment.hotel.name}`} className="group block" href={`/hotels/${assignment.hotel.slug}/`}>
                <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
                  {cover ? <Image alt={`نمای ساختمان هتل ${assignment.hotel.name}`} className="object-cover transition duration-500 group-hover:scale-105" fill sizes="(max-width: 768px) 100vw, 50vw" src={`${PUBLIC_API_BASE_URL}/media/${cover}`} /> : <span className="grid h-full place-items-center text-sm text-muted">بدون تصویر</span>}
                  <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl bg-brand/90 font-black text-white shadow-lg">{(hotelIndex + 1).toLocaleString("fa-IR")}</span>
                  {images.length > 1 ? <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-black text-white backdrop-blur">{images.length.toLocaleString("fa-IR")} تصویر</span> : null}
                </div>
                <div className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-base text-brand transition group-hover:text-accent-strong">{assignment.hotel.name}</strong>
                      <p className="mt-1 text-xs text-muted">{assignment.nights.toLocaleString("fa-IR")} شب{assignment.boardType ? ` · ${assignment.boardType}` : ""}</p>
                    </div>
                    <HotelStars className="shrink-0" rating={assignment.hotel.starRating} />
                  </div>
                  <span className="mt-3 inline-flex text-xs font-black text-accent-strong">مشاهده جزئیات هتل ←</span>
                </div>
              </Link>
              {images.length > 1 ? <div aria-label={`تصاویر دیگر ${assignment.hotel.name}`} className="flex gap-2 overflow-x-auto border-t border-sky-100 bg-sky-50/50 p-2.5">
                {images.slice(1, 4).map((imageId, imageIndex) => <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-lg border border-white bg-white" key={imageId}>
                  <Image alt={`${assignment.hotel.name}، تصویر ${imageIndex + 2}`} className="object-cover" fill sizes="64px" src={`${PUBLIC_API_BASE_URL}/media/${imageId}`} />
                </div>)}
              </div> : null}
            </article>
          );
        })}
      </div>
      <div className={`grid gap-2 border-t border-emerald-100 bg-emerald-50/70 p-4 sm:grid-cols-2 ${Number(item.extraPrice) > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {prices.map(([key, label, price, currency, addFlight, flightPrice, flightCurrency]) => (
          <div className="grid h-full grid-rows-[1fr_auto] gap-2" key={key}>
            <CombinedPackagePrice addFlight={addFlight} contactOnly={key === "infant" && price === null} currency={currency} flightCurrency={flightCurrency} flightPrice={flightPrice} label={label} price={price} supplement={key === "infant"} />
            {canPurchase && Number(price) > 0 ? <div className="mx-auto flex w-full max-w-32 items-center overflow-hidden rounded-xl border border-emerald-200 bg-white">
              <button aria-label={`کم کردن ${label}`} className="grid h-9 flex-1 place-items-center font-black text-brand disabled:opacity-35" disabled={selection[key] === 0} onClick={() => updateSelection(key, -1)} type="button">−</button>
              <output className="grid h-9 w-10 place-items-center border-x border-emerald-100 font-black text-brand">{(key === "double" ? selection[key] * 2 : selection[key]).toLocaleString("fa-IR")}</output>
              <button aria-label={`افزودن ${label}`} className="grid h-9 flex-1 place-items-center font-black text-brand disabled:opacity-35" disabled={selection[key] >= 20} onClick={() => updateSelection(key, 1)} type="button">+</button>
            </div> : null}
          </div>
        ))}
      </div>
      {requiresFlightQuote ? <div className="border-t border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950" role="status">
        <p className="font-black">قیمت‌های نمایش‌داده‌شده شامل نرخ پرواز نیستند؛ نرخ پرواز پس از اخذ ویزا اعلام و در لحظه صادر می‌شود.</p>
        <p>برای دریافت قیمت نهایی و ثبت درخواست با کارشناسان ما تماس بگیرید.</p>
        <Link className="mt-3 inline-flex rounded-xl bg-brand px-4 py-2 font-black text-white" href="/contact/">تماس با کارشناسان</Link>
      </div> : null}
      {canPurchase ? <div className="flex flex-wrap items-center gap-3 border-t border-violet-100 bg-white p-4">
        {requiresFlightQuote ? <p className="text-sm font-bold text-amber-900">این گزینه پس از اعلام نرخ پرواز قابل رزرو می‌شود.</p> : selectedCount ? <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm font-black text-brand">جمع قابل پرداخت: {total === null ? "نرخ ارز برای محاسبه نهایی نیاز است" : formatCurrency(total, "IRT")}</p> : <p className="text-sm text-muted">تعداد مسافران را برای این ترکیب انتخاب کنید.</p>}
        <CartAddButton buttonClassName="!bg-[#f12b75] hover:!bg-[#d91d62]" className="w-full sm:mr-auto sm:max-w-sm" combinedDeparturePriceId={item.combinedDeparturePriceId} disabled={requiresFlightQuote || !selectedCount || bookingDisabled || capacityExceeded} idleLabel={requiresFlightQuote ? "نیازمند استعلام نرخ پرواز" : bookingDisabled ? "این تاریخ قابل رزرو نیست" : capacityExceeded ? "ظرفیت کافی نیست" : "افزودن ترکیب به سبد خرید"} itemType="tour" roomSelection={selection} tourDepartureId={departureId ?? undefined} tourId={tourId} />
      </div> : null}
    </article>
  );
}
