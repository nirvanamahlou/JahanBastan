"use client";

import Link from "next/link";

import { DeparturePicker } from "./departure-picker";

import { TourHotelPresentation } from "./tour-hotel-presentation";
import hotelStyles from "./tour-hotel-presentation.module.css";
import { useEffect, useMemo, useState } from "react";

import { HotelAmenities } from "@/components/content/hotel-amenities";
import { HotelLocationMap } from "@/components/content/hotel-location-map";
import { SiteSelect } from "@/components/ui/site-select";
import { CombinedTourCheckout } from "@/components/checkout/combined-tour-checkout";
import { useOnlineSalesEnabled } from "@/components/online-sales-provider";
import { CloseIcon, SearchIcon } from "@/components/layout/site-icons";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { toToman, type ExchangeRates } from "@/lib/currency-conversion";
import { isFinalLocalTourPrice } from "@/lib/tour-price-currency";
import { isTourDepartureBookable, type TourDepartureAvailability } from "@/lib/tour-departure-availability";

type RoomSelection = {
  double: number;
  single: number;
  extra: number;
  childWithBed: number;
  childWithoutBed: number;
  infant: number;
};

type Hotel = {
  id: number;
  name: string;
  slug: string;
  starRating: number;
  defaultRoomType: string | null;
  guestRating: string | null;
  summary: string;
  region: string | null;
  address: string | null;
  amenitiesDescription: string | null;
  imageId: number | null;
  galleryImageIds: number[];
};

type HotelPrice = {
  id: number;
  hotel: Hotel;
  roomType: string;
  serviceType: string;
  doublePrice: string;
  singlePrice: string;
  extraPrice?: string | null;
  childWithBedPrice: string;
  packageCurrency: string;
  doubleCurrency?: string | null;
  singleCurrency?: string | null;
  extraCurrency?: string | null;
  childWithBedCurrency?: string | null;
  childWithoutBedPrice: string;
  childWithoutBedCurrency: string;
  infantPrice: string;
  infantCurrency: string;
  doubleFlightPrice?: string | null;
  singleFlightPrice?: string | null;
  flightPricePerPerson: string;
  flightCurrency: string;
  childWithBedFlightPrice?: string | null;
  childWithBedFlightCurrency?: string;
  isAvailable: boolean;
  isBasePackage: boolean;
  capacityTotal: number | null;
  capacityRemaining: number | null;
};

type DatedHotelOffer = HotelPrice & { departure: TourBookingDeparture };

export type TourBookingDeparture = TourDepartureAvailability & {
  id: number;
  label: string;
  departureDate: string | null;
  priceAmount: string | null;
  nights: number | null;
  currency: string;
  hotelPrices: HotelPrice[];
};

const emptySelection: RoomSelection = {
  double: 0,
  single: 0,
  extra: 0,
  childWithBed: 0,
  childWithoutBed: 0,
  infant: 0,
};

const INITIAL_VISIBLE_OFFERS = 8;

const rooms: Array<{
  key: keyof RoomSelection;
  label: string;
  price: keyof HotelPrice;
  currency: keyof HotelPrice;
}> = [
  { key: "double", label: "اتاق دوتخته", price: "doublePrice", currency: "doubleCurrency" },
  { key: "single", label: "اتاق یک‌تخته", price: "singlePrice", currency: "singleCurrency" },
  { key: "extra", label: "تخت اضافه", price: "extraPrice", currency: "extraCurrency" },
  { key: "childWithBed", label: "کودک با تخت", price: "childWithBedPrice", currency: "childWithBedCurrency" },
  { key: "childWithoutBed", label: "کودک بدون تخت", price: "childWithoutBedPrice", currency: "childWithoutBedCurrency" },
  { key: "infant", label: "نوزاد", price: "infantPrice", currency: "infantCurrency" },
];

function isBaseRoom(key: keyof RoomSelection) {
  return key === "double" || key === "single";
}

function roomQuantityLimit(selection: RoomSelection, key: keyof RoomSelection, capacity: number | null) {
  const roomCount = selection.double + selection.single;
  if (key === "extra") return roomCount > 0 ? 20 : 0;
  if (!isBaseRoom(key)) return Math.min(20, roomCount);
  return capacity === null ? 20 : Math.min(20, capacity - roomCount + selection[key]);
}

function normalizeHotelQuery(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

function formatPriceRangeLabel(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} میلیون تومان`;
  }

  return formatCurrency(value, "IRT");
}

export function TourHotelFilter({
  initialDepartureId,
  departures,
  tourId,
  tourSlug,
  destination,
  country,
  exchangeRates,
  faqs,
  isInstallmentAvailable,
}: {
  initialDepartureId?: number;
  departures: TourBookingDeparture[];
  packages?: unknown[];
  tourId: number;
  tourSlug: string;
  destination?: string | null;
  country?: string | null;
  exchangeRates: ExchangeRates;
  faqs?: { id: number; question: string; answer: string }[];
  isInstallmentAvailable: boolean;
}) {
  const availableDates = useMemo(
    () => departures.filter((item) => item.departureDate && item.hotelPrices.length && isTourDepartureBookable(item)),
    [departures],
  );
  const [departureId, setDepartureId] = useState<number | null>(initialDepartureId ?? availableDates[0]?.id ?? null);
  const [hotelId, setHotelId] = useState<number | "all">("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [stars, setStars] = useState<number | "all">("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [installmentOnly, setInstallmentOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [minimumTotal, setMinimumTotal] = useState("");
  const [maximumTotal, setMaximumTotal] = useState("");
  const [visibleOfferCount, setVisibleOfferCount] = useState(INITIAL_VISIBLE_OFFERS);
  const priceRangeLimit = 500_000_000;
  const minimumRangeValue = Math.max(0, Math.min(Number(minimumTotal) || 0, priceRangeLimit));
  const maximumRangeValue = Math.max(minimumRangeValue, Math.min(Number(maximumTotal) || priceRangeLimit, priceRangeLimit));
  const minimumRangePercent = (minimumRangeValue / priceRangeLimit) * 100;
  const maximumRangePercent = (maximumRangeValue / priceRangeLimit) * 100;
  const onlineSalesEnabled = useOnlineSalesEnabled();
  const [checkoutOfferId, setCheckoutOfferId] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<number, RoomSelection>>({});
  const faqItems = faqs ?? [];

  useEffect(() => {
    const selectDeparture = (event: Event) => {
      const departureIdFromEvent = (event as CustomEvent<{ departureId?: number }>).detail?.departureId;
      if (!departureIdFromEvent || !availableDates.some((item) => item.id === departureIdFromEvent)) return;
      setDepartureId(departureIdFromEvent);
      setHotelId("all");
      setRegionFilter("all");
    };
    window.addEventListener("tour-departure-selected", selectDeparture);
    return () => window.removeEventListener("tour-departure-selected", selectDeparture);
  }, [availableDates]);

  const selectedDeparture = availableDates.find((item) => item.id === departureId) ?? availableDates[0] ?? null;
  const activeDepartureId = selectedDeparture?.id ?? null;
  const packageOffers = useMemo<DatedHotelOffer[]>(
    () =>
      availableDates
        .flatMap((departure) =>
          departure.hotelPrices.map((hotelPrice) => ({
            ...hotelPrice,
            departure,
          })),
        )
        .sort((first, second) => {
          const available = (offer: DatedHotelOffer) => offer.isAvailable && offer.capacityRemaining !== 0 && rooms.some(room => room.key !== "infant" && Number(offer[room.price]) > 0);
          const availabilityOrder = Number(available(second)) - Number(available(first));
          if (availabilityOrder) return availabilityOrder;
          const firstTotal = hotelOfferTotalToToman(first, exchangeRates);
          const secondTotal = hotelOfferTotalToToman(second, exchangeRates);
          if (firstTotal === secondTotal) return 0;
          if (firstTotal === null) return 1;
          if (secondTotal === null) return -1;
          return firstTotal - secondTotal;
        }),
    [availableDates, exchangeRates],
  );
  const offers = useMemo(() => {
    const normalizedQuery = normalizeHotelQuery(query);
    return packageOffers.filter((offer) => {
      const matchesDeparture = offer.departure.id === activeDepartureId;
      const matchesHotel = hotelId === "all" || offer.hotel.id === hotelId;
      const hotelRegion = offer.hotel.region?.trim() || null;
      const matchesRegion = regionFilter === "all" || hotelRegion === regionFilter;
      const matchesStars = stars === "all" || offer.hotel.starRating === stars;
      const matchesQuery =
        !normalizedQuery ||
        [offer.hotel.name, offer.hotel.region, offer.roomType, offer.serviceType]
          .filter(Boolean)
          .some((value) =>
            normalizeHotelQuery(value!).includes(normalizedQuery),
          );
      const total = hotelOfferTotalToToman(offer, exchangeRates);
      const minimum = Number(minimumTotal) || 0;
      const maximum = Number(maximumTotal) || Number.POSITIVE_INFINITY;
      const matchesPrice = (!minimum && !maximumTotal) || (total !== null && total >= minimum && total <= maximum);
      const hasAvailableRoom = rooms.some(
        (room) => room.key !== "infant" && Number(offer[room.price]) > 0,
      ) && offer.isAvailable && (offer.capacityRemaining === null || offer.capacityRemaining > 0);
      const matchesAvailability = !availableOnly || hasAvailableRoom;
      const matchesInstallment = !installmentOnly || isInstallmentAvailable;
      return matchesDeparture && matchesHotel && matchesRegion && matchesStars && matchesQuery && matchesPrice && matchesAvailability && matchesInstallment;
    });
  }, [availableOnly, activeDepartureId, exchangeRates, hotelId, installmentOnly, isInstallmentAvailable, maximumTotal, minimumTotal, packageOffers, query, regionFilter, stars]);
  const visibleOffers = offers.slice(0, visibleOfferCount);

  const hotels = useMemo(() => {
    const map = new Map<number, Hotel>();
    packageOffers.forEach((offer) => map.set(offer.hotel.id, offer.hotel));
    return [...map.values()];
  }, [packageOffers]);
  const regions = useMemo(
    () =>
      [...new Set(
        packageOffers
          .filter((offer) => offer.departure.id === activeDepartureId)
          .map((offer) => offer.hotel.region?.trim())
          .filter((region): region is string => Boolean(region)),
      )].sort((first, second) => first.localeCompare(second, "fa")),
    [activeDepartureId, packageOffers],
  );
  function updateQuantity(offer: DatedHotelOffer, room: typeof rooms[number], delta: number) {
    if (!offer.isAvailable || offer.capacityRemaining === 0 || !(Number(offer[room.price]) > 0)) return;
    setSelections((current) => {
      const value = current[offer.id] ?? emptySelection;
      const key = room.key;
      const quantity = value[key] + delta;
      if (quantity < 0 || quantity > roomQuantityLimit(value, key, offer.capacityRemaining)) return current;
      const next = { ...value, [key]: quantity };
      if (delta < 0 && isBaseRoom(key)) {
        for (const { key: addOn } of rooms) {
          if (!isBaseRoom(addOn)) {
            next[addOn] = Math.min(next[addOn], roomQuantityLimit(next, addOn, offer.capacityRemaining));
          }
        }
      }
      return { ...current, [offer.id]: next };
    });
  }

  if (!availableDates.length) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-white p-8 text-center" id="tour-booking">
        <h2 className="text-2xl font-black text-brand">انتخاب تاریخ و هتل</h2>
        <p className="mt-3 text-muted">{departures.some((item) => item.departureDate && item.hotelPrices.length)
          ? "در حال حاضر تاریخ قابل رزروی برای نمایش هتل‌های این تور وجود ندارد."
          : "هنوز برای این تور تاریخ دارای هتل و قیمت ثبت نشده است."}</p>
      </section>
    );
  }

  return (
    <section className="scroll-mt-24 space-y-5" id="tour-booking">
      <div className="space-y-3">
        <aside className="rounded-2xl border border-border bg-white p-3 text-center">
          <h2 className="font-black text-brand">روزهای برگزاری تور</h2>
          <DeparturePicker options={availableDates} selected={selectedDeparture} available={isTourDepartureBookable} onSelect={(id) => {
            window.dispatchEvent(new CustomEvent("tour-hotels-duration-selected", { detail: { departureId: id } }));
            setDepartureId(id);
            setHotelId("all");
            setRegionFilter("all");
          }} />
        </aside>
      </div>

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside aria-label="فیلترهای هتل" className="h-fit min-w-0 rounded-[1.75rem] border border-[#ffd1e3] bg-gradient-to-b from-white to-[#fff6fa] p-3 shadow-[0_16px_40px_rgba(241,43,117,.09)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
          <div className="flex items-center justify-between border-b border-[#ffd7e6] pb-2.5"><h2 className="flex items-center gap-1.5 text-[.78rem] font-black text-brand"><span className="grid size-6 place-items-center rounded-xl bg-[#ffe3ee] text-[#f12b75]">☷</span>فیلترها</h2><button className="rounded-lg bg-[#fff0f6] px-2 py-1 text-xs font-bold text-[#e6236c]" onClick={() => { setHotelId("all"); setRegionFilter("all"); setStars("all"); setAvailableOnly(false); setInstallmentOnly(false); setQuery(""); setMinimumTotal(""); setMaximumTotal(""); }} type="button">پاک کردن</button></div>
          <label className="mt-3 grid min-w-0 gap-1.5 text-[.7rem] font-bold text-brand">جستجوی نام هتل<span className="relative block min-w-0"><SearchIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-[#e6236c]" /><input aria-label="جستجوی نام هتل در تور" autoComplete="off" className="box-border min-h-9 w-full min-w-0 rounded-xl border border-[#ffc7dc] bg-white px-3 ps-10 text-[.7rem] font-bold text-brand outline-none transition placeholder:text-muted focus:border-[#f12b75] focus:ring-4 focus:ring-[#ffdbe9]" dir="auto" onChange={(event) => setQuery(event.target.value)} placeholder="نام هتل را وارد کنید" type="search" value={query} />{query ? <button aria-label="پاک کردن جستجوی هتل" className="absolute start-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-[#fff0f6] hover:text-[#e6236c]" onClick={() => setQuery("")} type="button"><CloseIcon className="size-4" /></button> : null}</span></label>
          <div className="mt-3 grid gap-1.5 text-[.7rem] font-bold text-brand"><span>هتل</span><SiteSelect className="min-h-9! text-[.7rem]!" ariaLabel="هتل" id="tour-hotel-filter" onValueChange={(nextValue) => setHotelId(nextValue === "all" ? "all" : Number(nextValue))} options={[{ label: "همه هتل‌ها", value: "all" }, ...hotels.map((hotel) => ({ label: hotel.name, value: String(hotel.id) }))]} searchable value={String(hotelId)} /></div>
          <div className="mt-3 grid gap-1.5 text-[.7rem] font-bold text-brand"><span>منطقه هتل</span><SiteSelect className="min-h-9! text-[.7rem]!" ariaLabel="منطقه هتل" id="tour-region-filter" onValueChange={setRegionFilter} options={[{ label: "همه مناطق", value: "all" }, ...regions.map((region) => ({ label: region, value: region }))]} value={regionFilter} /></div>
          <fieldset className="mt-3.5 border-t border-[#ffd7e6] pt-2.5"><legend className="px-1 text-[.7rem] font-black text-brand">درجه هتل</legend>{(["all", 5, 4, 3, 2, 1] as const).map((value) => (<button aria-pressed={stars === value} className={`mt-2 flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-[.7rem] transition ${stars === value ? "border-[#f12b75] bg-[#fff0f6] text-[#e6236c]" : "border-[#ffe0ec] bg-white text-muted hover:border-[#f69abd]"}`} key={value} onClick={() => setStars(value)} type="button"><span className={`grid size-5 place-items-center rounded-md border ${stars === value ? "border-[#f12b75] bg-[#f12b75] text-white" : "border-[#f2bfd3] bg-white"}`}>{stars === value ? "✓" : ""}</span><span>{value === "all" ? "همه هتل‌ها" : `${value.toLocaleString("fa-IR")} ستاره`}</span><span className="tracking-[.08em] text-[#f12b75]">{value === "all" ? "★★★★★" : "★".repeat(value)}</span></button>))}</fieldset>
                    <fieldset className="mt-3.5 border-t border-[#ffd7e6] pt-2.5">
            <legend className="px-1 text-[.7rem] font-black text-brand">فیلترهای تور</legend>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#ffe0ec] bg-white px-2.5 py-1.5 text-[.7rem] font-black text-brand transition hover:border-[#f69abd]">
              <span>فقط تورهای موجود</span>
              <input checked={availableOnly} className="size-5 accent-[#f12b75]" onChange={(event) => setAvailableOnly(event.target.checked)} type="checkbox" />
            </label>
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#ffe0ec] bg-white px-2.5 py-1.5 text-[.7rem] font-black text-brand transition hover:border-[#f69abd]">
              <span>فقط تورهای اقساطی</span>
              <input checked={installmentOnly} className="size-5 accent-[#f12b75]" onChange={(event) => setInstallmentOnly(event.target.checked)} type="checkbox" />
            </label>
          </fieldset>
          <fieldset className="mt-3.5 border-t border-[#ffd7e6] pt-2.5">
            <legend className="text-[.7rem] font-black text-brand">بازه قیمت نهایی (تومان)</legend>
            <div className="relative mt-4 h-6" dir="rtl">
              <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#f7d7e4]" />
              <span aria-hidden="true" className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#f12b75]" style={{ left: `${100 - maximumRangePercent}%`, width: `${maximumRangePercent - minimumRangePercent}%` }} />
              <input aria-label={"\u062d\u062f\u0627\u0642\u0644 \u0642\u06cc\u0645\u062a"} className="pointer-events-none absolute inset-x-0 top-0 z-20 h-6 w-full cursor-pointer appearance-none bg-transparent [transform:scaleX(-1)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#f12b75] [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f12b75] [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(241,43,117,.35)]" max={priceRangeLimit} min="0" onChange={(event) => setMinimumTotal(String(Math.min(Number(event.target.value), maximumRangeValue)))} step="500000" type="range" value={minimumRangeValue} />
              <input aria-label={"\u062d\u062f\u0627\u06a9\u062b\u0631 \u0642\u06cc\u0645\u062a"} className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 w-full cursor-pointer appearance-none bg-transparent [transform:scaleX(-1)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#f12b75] [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f12b75] [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(241,43,117,.35)]" max={priceRangeLimit} min="0" onChange={(event) => setMaximumTotal(String(Math.max(Number(event.target.value), minimumRangeValue)))} step="500000" type="range" value={maximumRangeValue} />
            </div>
            <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-[10px] font-bold leading-4 text-[#e6236c]" dir="rtl">
              <span className="min-w-0 text-right" title={formatCurrency(minimumRangeValue, "IRT")}>{formatPriceRangeLabel(minimumRangeValue)}</span>
              <span className="min-w-0 text-left" title={maximumTotal ? formatCurrency(maximumRangeValue, "IRT") : "بدون سقف"}>{maximumTotal ? formatPriceRangeLabel(maximumRangeValue) : "بدون سقف"}</span>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
              <input aria-label="حداقل قیمت به تومان" className="box-border w-full min-w-0 rounded-xl border border-[#ffc7dc] bg-white px-1 py-2 text-center text-[11px] tabular-nums outline-none [appearance:textfield] focus:border-[#f12b75] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" dir="ltr" inputMode="numeric" onChange={(event) => setMinimumTotal(event.target.value)} placeholder="از" type="number" value={minimumTotal} />
              <input aria-label="حداکثر قیمت به تومان" className="box-border w-full min-w-0 rounded-xl border border-[#ffc7dc] bg-white px-1 py-2 text-center text-[11px] tabular-nums outline-none [appearance:textfield] focus:border-[#f12b75] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" dir="ltr" inputMode="numeric" onChange={(event) => setMaximumTotal(event.target.value)} placeholder="تا" type="number" value={maximumTotal} />
            </div>
          </fieldset>
        </aside>
        <div className="min-w-0 space-y-4" id="tour-hotel-results">
          {visibleOffers.map((offer) => {
            const selection = selections[offer.id] ?? emptySelection;
            const showRooms = rooms.filter(room => room.key !== "extra" || Number(offer.extraPrice) > 0);
            const availableRooms = offer.isAvailable && offer.capacityRemaining !== 0
              ? showRooms.filter(room => Number(offer[room.price]) > 0)
              : [];
            const canSelectRoom = availableRooms.some(room => isBaseRoom(room.key));
            const roomCount = selection.double + selection.single;
            const selectionTotal = rooms.reduce<number | null>((total, room) => {
              if (total === null || !selection[room.key]) return total;
              const roomAmount = tourPriceToToman(String(offer[room.price]), String(offer[room.currency] ?? offer.packageCurrency), exchangeRates);
              const [flight, currency] = roomFlight(offer, room.key);
              const flightAmount = Number(flight) > 0 ? tourPriceToToman(flight, currency, exchangeRates) : 0;
              if (roomAmount === null || flightAmount === null) return null;
              const passengerFactor = room.key === "double" ? 2 : 1;
              return total + (roomAmount * passengerFactor + flightAmount * passengerFactor) * selection[room.key];
            }, 0);
            return (
              <article className={`${hotelStyles.hotelCardAccent} min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_8px_24px_rgba(16,39,71,.08)]`} key={offer.id}>
                <TourHotelPresentation name={offer.hotel.name} href={`/hotels/${offer.hotel.slug}/?tour=${encodeURIComponent(tourSlug)}`}
                  images={[...new Set([offer.hotel.imageId,...(offer.hotel.galleryImageIds ?? [])])].filter(Boolean).map(id => `${PUBLIC_API_BASE_URL}/media/${id}`)}
                  location={[offer.hotel.region,destination,country].filter(Boolean).join("، ")}
                  locationMap={<HotelLocationMap address={offer.hotel.address} compact country={country} destination={destination} name={offer.hotel.name} region={offer.hotel.region} />}
                  stars={offer.hotel.starRating} summary={offer.hotel.summary} facilities={offer.hotel.amenitiesDescription}
                  amenities={<HotelAmenities description={offer.hotel.amenitiesDescription} region={offer.hotel.region} roomType={offer.roomType} serviceType={offer.serviceType} variant="tour-card" />} badges={offer.isBasePackage ? <span className="inline-flex items-center rounded-lg bg-brand-soft px-2 py-1 text-xs font-bold text-brand">هتل پایه پکیج</span> : null}
                  rates={<div className={hotelStyles.rateGrid} aria-label="نرخ‌های اتاق و مسافر">
                    {showRooms.map((room) => {
                      const available = availableRooms.includes(room);
                      const quantity = selection[room.key];
                      const double = room.key === "double";
                      return (
                        <div className={hotelStyles.rateTile} data-room-kind={room.key} data-primary={double && available} data-active={quantity > 0} data-unavailable={!available} key={room.key}>
                          <p className={hotelStyles.rateLabel}>{room.label}{double ? " (۲ نفر)" : ""}</p>
                          <div className={hotelStyles.ratePrice}>
                            {available ? <RoomPrice offer={offer} room={room} /> : <span className="font-bold text-muted">ناموجود</span>}
                          </div>
                          {available && canSelectRoom ? (
                            <div className={hotelStyles.rateControl}>
                              <button aria-label={double ? "کم کردن یک اتاق دوتخته" : `کم کردن ${room.label}`} className="hover:bg-surface-muted disabled:opacity-35" disabled={!quantity} onClick={() => updateQuantity(offer, room, -1)} type="button">−</button>
                              <output aria-label={double ? "تعداد مسافر اتاق دوتخته" : `تعداد ${room.label}`}>{(double ? quantity * 2 : quantity).toLocaleString("fa-IR")}</output>
                              <button aria-label={double ? "افزودن یک اتاق دوتخته" : `افزودن ${room.label}`} className="hover:bg-surface-muted disabled:opacity-35" disabled={quantity >= roomQuantityLimit(selection, room.key, offer.capacityRemaining)} onClick={() => updateQuantity(offer, room, 1)} type="button">+</button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>} />
                {canSelectRoom && roomCount > 0 ? (
                  <div className={hotelStyles.inlineBooking} data-inline-hotel-booking>
                    <p className="text-xs font-bold text-brand">جمع قابل پرداخت: {selectionTotal === null ? "نیازمند محاسبهٔ نرخ ارز" : formatCurrency(selectionTotal, "IRT")}</p>
                    {onlineSalesEnabled ? (
                      <button className="account-primary min-h-10 w-full rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50 sm:w-auto"
                        disabled={Object.values(selection).reduce((total, value) => total + value, selection.double) > 20}
                        onClick={() => setCheckoutOfferId(offer.id)} type="button">
                        خرید و ادامه ورود اطلاعات مسافران
                      </button>
                    ) : <Link className="account-primary rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white" href="/contact/">تماس با کارشناسان</Link>}
                  </div>
                ) : !canSelectRoom ? <p className={hotelStyles.bookingUnavailable}>{!offer.isAvailable || offer.capacityRemaining === 0 ? "تکمیل ظرفیت" : "استعلام قیمت و ظرفیت"}</p> : null}
                {checkoutOfferId === offer.id && roomCount > 0 && canSelectRoom ? (
                  <CombinedTourCheckout departureId={offer.departure.id} onClose={() => setCheckoutOfferId(null)}
                    roomSelection={selection} tourHotelPriceId={offer.id} tourId={tourId} />
                ) : null}
              </article>
            );
          })}
          {visibleOfferCount < offers.length ? (
            <button
              aria-controls="tour-hotel-results"
              className="mx-auto flex min-h-11 items-center justify-center rounded-xl border border-brand px-6 font-black text-brand transition hover:bg-brand hover:text-white"
              onClick={() => setVisibleOfferCount((count) => count + INITIAL_VISIBLE_OFFERS)}
              type="button"
            >
              نمایش هتل‌های بیشتر ({(offers.length - visibleOfferCount).toLocaleString("fa-IR")})
            </button>
          ) : null}
          {!offers.length ? <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">هتلی با این فیلترها پیدا نشد.</div> : null}
        </div>
      </div>
      {faqItems.length ? <section className="rounded-3xl border border-[#d6e5f8] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-black text-accent-strong">راهنمای رزرو</p><h2 className="mt-1 text-2xl font-black text-brand">سوالات متداول</h2></div><span className="text-sm text-muted">پاسخ پرسش‌های پرتکرار پیش از انتخاب هتل</span></div><div className="mt-5 divide-y divide-[#dce8f6]">{faqItems.map((faq, index) => <details className="group py-3" key={faq.id} open={index === 0}><summary className="cursor-pointer list-none font-black text-brand"><span className="ml-3 inline-grid size-7 place-items-center rounded-full bg-[#fff0f6] text-accent-strong">+</span>{faq.question}</summary><p className="mr-10 mt-3 leading-7 text-muted">{faq.answer}</p></details>)}</div></section> : null}
    </section>
  );
}



function tourLocalCurrency(currency: string | null | undefined) {
  const normalized = currency?.toUpperCase();
  return normalized === "IRR" || normalized === "RIAL" ? "IRT" : currency;
}

function isForeignTourPrice(currency: string | null | undefined) {
  return (tourLocalCurrency(currency) ?? "IRT").toUpperCase() !== "IRT";
}

function formatTourBookingPrice(value: string | number | null | undefined, currency: string | null | undefined) {
  return formatCurrency(value, tourLocalCurrency(currency));
}

function tourPriceToToman(value: string | number | null | undefined, currency: string | null | undefined, rates: ExchangeRates) {
  return toToman(value, tourLocalCurrency(currency), rates);
}

function hotelOfferTotalToToman(offer: HotelPrice, rates: ExchangeRates) {
  // Compare adult prices; a missing double-room price must not rank as free.
  const hasDouble = Number(offer.doublePrice) > 0;
  const roomPrice = hasDouble ? offer.doublePrice : offer.singlePrice;
  const roomCurrency = (hasDouble ? offer.doubleCurrency : offer.singleCurrency) ?? offer.packageCurrency;
  if (!(Number(roomPrice) > 0)) return null;
  const roomTotal = tourPriceToToman(roomPrice, roomCurrency, rates);
  const adultFlight = (hasDouble ? offer.doubleFlightPrice : offer.singleFlightPrice) ?? offer.flightPricePerPerson;
  const flightTotal = Number(adultFlight) > 0
    ? tourPriceToToman(adultFlight, offer.flightCurrency, rates)
    : 0;
  return roomTotal === null || flightTotal === null ? null : roomTotal + flightTotal;
}

function roomFlight(offer: HotelPrice, room: keyof RoomSelection): [string, string] {
  if (room === "childWithBed" && isFinalLocalTourPrice(offer.childWithBedCurrency ?? offer.packageCurrency)) return ["0", "IRT"];
  if (room === "childWithBed") return [offer.childWithBedFlightPrice ?? "0", offer.childWithBedFlightCurrency ?? "IRT"];
  if (room === "childWithoutBed" && isForeignTourPrice(offer.childWithoutBedCurrency)) return [offer.childWithBedFlightPrice ?? "0", offer.childWithBedFlightCurrency ?? "IRT"];
  if (room === "double") return [offer.doubleFlightPrice ?? offer.flightPricePerPerson, offer.flightCurrency];
  if (room === "single") return [offer.singleFlightPrice ?? offer.flightPricePerPerson, offer.flightCurrency];
  if (room === "extra") return [offer.flightPricePerPerson, offer.flightCurrency];
  return ["0", "IRT"];
}

function RoomPrice({ offer, room }: { offer: HotelPrice; room: typeof rooms[number] }) {
  const hotelPrice = formatTourBookingPrice(
    String(offer[room.price]),
    String(offer[room.currency] ?? offer.packageCurrency),
  );
  if (room.key === "infant" || (room.key === "childWithBed" && isFinalLocalTourPrice(offer.childWithBedCurrency ?? offer.packageCurrency)) || (room.key === "childWithoutBed" && !isForeignTourPrice(offer.childWithoutBedCurrency))) {
    return <>
      <strong className="block text-sm text-brand">{hotelPrice}</strong>
      {room.key === "childWithBed" ? <span>مبلغ نهایی</span> : null}
    </>;
  }
  const [flight, flightCurrency] = roomFlight(offer, room.key);
  const hasFlight = Number(flight) > 0;
  const flightPrice = formatTourBookingPrice(flight, flightCurrency);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 font-bold text-brand">
      <span>{hotelPrice}</span>
      {hasFlight ? (
        <>
          <span aria-label="به علاوه" className="text-lg leading-none text-muted">
            +
          </span>
          <span>{flightPrice}</span>
        </>
      ) : null}
      {!hasFlight ? <span className="basis-full text-[11px] font-medium text-muted">هزینه هتل</span> : null}
    </div>
  );
}
