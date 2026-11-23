"use client";

import { Time24Input } from "@/components/ui/time-24-input";

import { useState } from "react";

import { ClearableTimeInput } from "@/components/admin/clearable-time-input";
import { CurrencySelect } from "@/components/admin/currency-select";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import { MediaUpload } from "@/components/admin/media-upload";
import type {
  DestinationOption,
  HotelOption,
  TourDeparture,
  TourItineraryDay,
  TourTravelLeg,
} from "@/types/editorial";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { TOUR_STAGE_TYPES, tourStageTypeLabel } from "@/lib/tour-stage-type";

const field =
  "w-full rounded-xl border border-brand/25 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";
const tourHeaderBox =
  "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950";
const tourLegend =
  "mx-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-black text-emerald-950";
const stageLabel = "space-y-1.5 text-xs font-bold text-foreground";
const stageTypes = TOUR_STAGE_TYPES;

function emptyDeparture(date: string | null) {
  return {
    label: date || "تاریخ برگزاری جدید",
    departureDate: date,
    returnDate: null,
    externalCode: null,
    priceSetCode: null,
    capacityTotal: null,
    capacityRemaining: null,
    bookingStatus: "open" as const,
    outboundFlightNumber: null,
    outboundAirlineName: null,
    outboundAirlineLogoImageId: null,
    outboundOriginAirport: null,
    outboundOriginAirportCode: null,
    outboundDestinationAirport: null,
    outboundDestinationAirportCode: null,
    outboundDepartureTime: null,
    outboundArrivalTime: null,
    outboundBaggageAllowanceKg: null,
    outboundAircraftName: null,
    outboundTravelClass: null,
    returnFlightNumber: null,
    returnAirlineName: null,
    returnAirlineLogoImageId: null,
    returnOriginAirport: null,
    returnOriginAirportCode: null,
    returnDestinationAirport: null,
    returnDestinationAirportCode: null,
    returnDepartureTime: null,
    returnArrivalTime: null,
    returnBaggageAllowanceKg: null,
    returnAircraftName: null,
    returnTravelClass: null,
    priceAmount: null,
    nights: null,
    currency: "IRT",
    hotelPrices: [],
  };
}

export function StructuredTourFields({
  hotels,
  destinations,
  itineraryDays,
  departures,
  travelLegs,
  onItineraryChange,
  onDeparturesChange,
  onTravelLegsChange,
}: {
  hotels: HotelOption[];
  destinations: DestinationOption[];
  itineraryDays: TourItineraryDay[];
  departures: TourDeparture[];
  travelLegs: TourTravelLeg[];
  onItineraryChange: (items: TourItineraryDay[]) => void;
  onDeparturesChange: (items: TourDeparture[]) => void;
  onTravelLegsChange: (items: TourTravelLeg[]) => void;
}) {
  const [selectedDepartureIndex, setSelectedDepartureIndex] = useState(0);
  const [hotelQuery, setHotelQuery] = useState("");
  const [selectedHotelIds, setSelectedHotelIds] = useState<number[]>([]);
  const [rangeStartDate, setRangeStartDate] = useState<string | null>(null);
  const [rangeEndDate, setRangeEndDate] = useState<string | null>(null);
  const [rangeHotelId, setRangeHotelId] = useState<string>("all");
  const normalizedHotelQuery = hotelQuery.trim().toLocaleLowerCase("fa-IR");
  const filteredHotels = normalizedHotelQuery
    ? hotels.filter((hotel) => `${hotel.name} ${hotel.city ?? ""} ${hotel.hotelCode ?? ""}`.toLocaleLowerCase("fa-IR").includes(normalizedHotelQuery))
    : hotels;
  const hotelOptionsFor = (hotelId?: number) => {
    const selected = hotels.find((hotel) => hotel.id === hotelId);
    return selected && !filteredHotels.some((hotel) => hotel.id === selected.id)
      ? [selected, ...filteredHotels]
      : filteredHotels;
  };
  const activeDepartureIndex = Math.min(
    selectedDepartureIndex,
    Math.max(0, departures.length - 1),
  );
  const selectedDeparture = departures[activeDepartureIndex] ?? null;

  function addSelectedHotelsToActiveDeparture() {
    if (!selectedDeparture || !selectedHotelIds.length) return;
    const existingHotelIds = new Set(
      selectedDeparture.hotelPrices.map((offer) => offer.hotelId ?? offer.hotel?.id),
    );
    const selectedIds = selectedHotelIds.filter((hotelId) => !existingHotelIds.has(hotelId));
    const alreadyHasBase = selectedDeparture.hotelPrices.some(
      (offer) => offer.isBasePackage,
    );
    const additions = selectedIds.map((hotelId, index) =>
      createHotelOffer(
        hotelId,
        !alreadyHasBase && index === 0,
        selectedDeparture.priceSetCode,
      ),
    );
    onDeparturesChange(
      departures.map((departure, index) =>
        index === activeDepartureIndex
          ? {
              ...departure,
              hotelPrices: [...departure.hotelPrices, ...additions],
            }
          : departure,
      ),
    );
    setSelectedHotelIds([]);
  }

  function applyHotelAvailability(isAvailable: boolean) {
    if (!rangeStartDate || !rangeEndDate) return;
    const startDate = rangeStartDate <= rangeEndDate ? rangeStartDate : rangeEndDate;
    const endDate = rangeStartDate <= rangeEndDate ? rangeEndDate : rangeStartDate;
    onDeparturesChange(
      departures.map((departure) => {
        if (
          !departure.departureDate ||
          departure.departureDate < startDate ||
          departure.departureDate > endDate
        ) {
          return departure;
        }
        return {
          ...departure,
          hotelPrices: departure.hotelPrices.map((offer) =>
            rangeHotelId === "all" ||
            String(offer.hotelId ?? offer.hotel?.id) === rangeHotelId
              ? { ...offer, isAvailable }
              : offer,
          ),
        };
      }),
    );
  }

  function removeDeparture(index: number) {
    if (!window.confirm("این تاریخ و همه هتل‌ها و قیمت‌های مخصوص آن حذف شوند؟")) return;
    onDeparturesChange(departures.filter((_, itemIndex) => itemIndex !== index));
    setSelectedDepartureIndex((current) => Math.max(0, Math.min(current, departures.length - 2)));
  }

  function updateTravelLeg(index: number, changes: Partial<TourTravelLeg>) {
    onTravelLegsChange(
      travelLegs.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    );
  }

  return (
    <>
      <Collection
        addLabel="افزودن مرحله"
        title="برنامه سفر و رویدادهای تور"
        onAdd={() => onTravelLegsChange([
          ...travelLegs,
          {
            destinationId: null,
            hotelId: null,
            title: null,
            description: null,
            stageType: null,
            durationMinutes: null,
            travelClass: null,
            baggageAllowanceKg: null,
            transportation: null,
            departureDate: null,
            arrivalDate: null,
            departureTime: null,
            arrivalTime: null,
            airlineName: null,
            flightNumber: null,
            stayNights: null,
            origin: null,
            originTerminal: null,
            destination: null,
            destinationTerminal: null,
          },
        ])}
      >
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-6 text-sky-900">
          مراحل از شروع تور تا پایان سفر به همین ترتیب نمایش داده می‌شوند. چون هر نوبت تور تاریخ متفاوتی دارد، برای هر مرحله فقط ساعت، مدت‌زمان و جزئیات لازم را وارد کنید.
        </p>
        {!travelLegs.length ? (
          <div className="rounded-xl border border-dashed border-brand/30 bg-surface-muted px-4 py-8 text-center text-sm text-muted">
            هنوز مرحله‌ای ثبت نشده است. برای ساخت برنامه سفر، «افزودن مرحله» را بزنید.
          </div>
        ) : null}
        {travelLegs.map((leg, index) => (
          <section className="space-y-5 rounded-2xl border border-brand/20 bg-white p-3 shadow-[0_8px_24px_rgba(1,37,105,0.06)] sm:p-4" key={index}>
            <header className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-brand">مرحله {(index + 1).toLocaleString("fa-IR")}</h3>
              <button aria-label={`حذف مرحله ${(index + 1).toLocaleString("fa-IR")}`} className="rounded-lg px-2 py-1 text-sm font-black text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400" onClick={() => onTravelLegsChange(travelLegs.filter((_, itemIndex) => itemIndex !== index))} type="button">حذف مرحله</button>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={stageLabel}>
                <span>نوع مرحله (اختیاری)</span>
                <select className={field} onChange={(event) => updateTravelLeg(index, { stageType: event.target.value || null })} value={leg.stageType ?? ""}>
                  <option value="">انتخاب نوع مرحله</option>
                  {leg.stageType && !stageTypes.includes(leg.stageType as (typeof stageTypes)[number]) ? <option value={leg.stageType}>{tourStageTypeLabel(leg.stageType)}</option> : null}
                  {stageTypes.map((stageType) => <option key={stageType} value={stageType}>{stageType}</option>)}
                </select>
              </label>
              <label className={stageLabel}>
                <span>عنوان مرحله (اختیاری)</span>
                <input className={field} maxLength={160} onChange={(event) => updateTravelLeg(index, { title: event.target.value || null })} placeholder="مثلاً شروع تور و حرکت از مبدأ" value={leg.title ?? ""} />
              </label>
              <label className={stageLabel}>
                <span>شهر یا محل رویداد (اختیاری)</span>
                <input className={field} onChange={(event) => updateTravelLeg(index, { destination: event.target.value || null })} placeholder="مثلاً فرودگاه، هتل یا شهر" value={leg.destination ?? ""} />
              </label>
              <label className={stageLabel}>
                <span>مدت اقامت در این مقصد (روز، اختیاری)</span>
                <input className={field} min={1} onChange={(event) => updateTravelLeg(index, { stayNights: event.target.value ? Number(event.target.value) : null })} placeholder="مثلاً ۳" type="number" value={leg.stayNights ?? ""} />
              </label>
              <div className="grid gap-4 md:col-span-2 md:grid-cols-4">
                <label className={stageLabel}>
                  <span>ساعت شروع (اختیاری)</span>
                  <Time24Input className={field} onValueChange={(value) => updateTravelLeg(index, { departureTime: value || null })} value={leg.departureTime?.slice(0, 5) ?? ""} />
                  <small className="block font-normal text-muted">فرمت ۲۴ ساعته؛ مثلاً ۱۴:۳۰</small>
                </label>
                <label className={stageLabel}>
                  <span>مدت‌زمان (دقیقه، اختیاری)</span>
                  <input className={field} min={0} onChange={(event) => updateTravelLeg(index, { durationMinutes: event.target.value ? Number(event.target.value) : null })} placeholder="مثلاً ۹۰" type="number" value={leg.durationMinutes ?? ""} />
                </label>
                <label className={`${stageLabel} md:col-span-2`}>
                  <span>وسیله جابه‌جایی (اختیاری)</span>
                  <input className={field} maxLength={80} onChange={(event) => updateTravelLeg(index, { transportation: event.target.value || null })} placeholder="هواپیما، قطار، اتوبوس..." value={leg.transportation ?? ""} />
                </label>
              </div>
              <label className={stageLabel}>
                <span>کلاس سفر (اختیاری)</span>
                <input className={field} maxLength={80} onChange={(event) => updateTravelLeg(index, { travelClass: event.target.value || null })} placeholder="مثلاً اقتصادی" value={leg.travelClass ?? ""} />
              </label>
              <label className={stageLabel}>
                <span>بار مجاز (کیلوگرم، اختیاری)</span>
                <input className={field} min={0} onChange={(event) => updateTravelLeg(index, { baggageAllowanceKg: event.target.value ? Number(event.target.value) : null })} placeholder="مثلاً ۲۰" type="number" value={leg.baggageAllowanceKg ?? ""} />
              </label>
              <label className={`${stageLabel} md:col-span-2`}>
                <span>توضیحات این مرحله (اختیاری)</span>
                <textarea className={`${field} min-h-32 resize-y leading-7`} maxLength={5000} onChange={(event) => updateTravelLeg(index, { description: event.target.value || null })} placeholder="جزئیات لازم برای مسافر را وارد کنید." rows={5} value={leg.description ?? ""} />
              </label>
            </div>

            <details className="group rounded-xl border border-amber-200 bg-amber-50/45 p-3">
              <summary className="cursor-pointer list-none text-sm font-black text-amber-900 marker:content-none"><span className="inline-flex items-center gap-2 before:text-xs before:content-['◀'] group-open:before:content-['▼']">جزئیات تکمیلی مسیر، پرواز و اقامت</span></summary>
              <div className="mt-4 grid gap-4 border-t border-amber-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className={stageLabel}>
                  <span>اتصال به مقصد ثبت‌شده</span>
                  <select className={field} onChange={(event) => { const destinationId = event.target.value ? Number(event.target.value) : null; const selected = destinations.find((item) => item.id === destinationId); updateTravelLeg(index, { destinationId, destination: selected?.title ?? leg.destination }); }} value={leg.destinationId ?? ""}>
                    <option value="">بدون اتصال</option>
                    {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.title}</option>)}
                  </select>
                </label>
                <label className={stageLabel}>
                  <span>هتل این مرحله</span>
                  <select className={field} onChange={(event) => updateTravelLeg(index, { hotelId: event.target.value ? Number(event.target.value) : null })} value={leg.hotelId ?? ""}>
                    <option value="">بدون هتل</option>
                    {hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}{hotel.city ? ` · ${hotel.city}` : ""}</option>)}
                  </select>
                </label>
                <label className={stageLabel}><span>نام ایرلاین</span><input className={field} maxLength={120} onChange={(event) => updateTravelLeg(index, { airlineName: event.target.value || null })} placeholder="مثلاً ترکیش ایرلاینز" value={leg.airlineName ?? ""} /></label>
                <label className={stageLabel}><span>شماره پرواز</span><input className={field} maxLength={32} onChange={(event) => updateTravelLeg(index, { flightNumber: event.target.value || null })} placeholder="مثلاً TK875" value={leg.flightNumber ?? ""} /></label>
                <label className={stageLabel}><span>تاریخ حرکت</span><JalaliDateInput ariaLabel="تاریخ حرکت این مرحله" className={field} onChange={(departureDate) => updateTravelLeg(index, { departureDate })} value={leg.departureDate} /></label>
                <label className={stageLabel}><span>تاریخ ورود</span><JalaliDateInput ariaLabel="تاریخ ورود این مرحله" className={field} onChange={(arrivalDate) => updateTravelLeg(index, { arrivalDate })} value={leg.arrivalDate} /></label>
                <label className={stageLabel}><span>ساعت رسیدن</span><Time24Input className={field} onValueChange={(value) => updateTravelLeg(index, { arrivalTime: value || null })} value={leg.arrivalTime?.slice(0, 5) ?? ""} /></label>
                <label className={stageLabel}><span>شهر مبدأ</span><input className={field} onChange={(event) => updateTravelLeg(index, { origin: event.target.value || null })} placeholder="مثلاً تهران" value={leg.origin ?? ""} /></label>
                <label className={stageLabel}><span>پایانه یا فرودگاه مبدأ</span><input className={field} onChange={(event) => updateTravelLeg(index, { originTerminal: event.target.value || null })} placeholder="مثلاً فرودگاه امام خمینی" value={leg.originTerminal ?? ""} /></label>
                <label className={stageLabel}><span>پایانه یا فرودگاه مقصد</span><input className={field} onChange={(event) => updateTravelLeg(index, { destinationTerminal: event.target.value || null })} placeholder="مثلاً فرودگاه عدنان مندرس" value={leg.destinationTerminal ?? ""} /></label>
              </div>
            </details>
          </section>
        ))}
      </Collection>
      <Collection title="برنامه روزانه" onAdd={() => onItineraryChange([...itineraryDays, { dayNumber: itineraryDays.length + 1, title: `روز ${itineraryDays.length + 1}`, description: "" }])}>
        {itineraryDays.map((day, index) => (
          <div className="grid gap-2 rounded-xl bg-surface-muted p-3" key={index}>
            <div className="grid grid-cols-[5rem_1fr_auto] gap-2">
              <input aria-label="شماره روز" className={field} min={1} onChange={(event) => onItineraryChange(itineraryDays.map((item, itemIndex) => itemIndex === index ? { ...item, dayNumber: Number(event.target.value) } : item))} type="number" value={day.dayNumber} />
              <input aria-label="عنوان روز" className={field} onChange={(event) => onItineraryChange(itineraryDays.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} value={day.title} />
              <RemoveButton onClick={() => onItineraryChange(itineraryDays.filter((_, itemIndex) => itemIndex !== index))} />
            </div>
            <RichTextEditor label="شرح برنامه روز" onChange={(description) => onItineraryChange(itineraryDays.map((item, itemIndex) => itemIndex === index ? { ...item, description } : item))} rows={4} value={day.description} />
          </div>
        ))}
      </Collection>

      <Collection
        title="تاریخ‌ها، هتل‌ها و قیمت پرواز تور"
        onAdd={() =>
          onDeparturesChange([
            ...departures,
            emptyDeparture(null),
          ])
        }
      >
        <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs leading-6 text-muted">
          تاریخ به‌تنهایی قیمت ندارد. برای هر تاریخ، هتل، نوع اتاق، خدمات هتل،
          قیمت ارزی اقامت و قیمت پرواز به تومان را ثبت کنید. داده‌های واردشده از
          Excel نیز در همین قسمت باقی می‌مانند و قابل ویرایش هستند.
        </p>
        {departures.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="تاریخ‌های برگزاری تور">
            {departures.map((departure, index) => (
              <button
                aria-selected={activeDepartureIndex === index}
                className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-black transition ${selectedDepartureIndex === index ? "border-brand bg-brand text-white" : "border-border bg-background text-brand hover:border-brand/50"}`}
                key={departure.id ?? `departure-${index}`}
                onClick={() => setSelectedDepartureIndex(index)}
                role="tab"
                type="button"
              >
                {departure.label || `تاریخ ${(index + 1).toLocaleString("fa-IR")}`}{departure.nights ? ` · ${departure.nights.toLocaleString("fa-IR")} شب` : ""}
              </button>
            ))}
          </div>
        ) : null}
        {selectedDeparture ? (() => {
          const departure = selectedDeparture;
          const index = activeDepartureIndex;
          const updateDeparture = (changes: Partial<TourDeparture>) =>
            onDeparturesChange(
              departures.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...changes } : item,
              ),
            );
          return (
            <div className="space-y-4 rounded-xl border border-border p-4" data-tour-departure-card key={departure.id ?? index}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_0.7fr_auto]">
                <input aria-label="عنوان تاریخ" className={field} onChange={(event) => updateDeparture({ label: event.target.value })} placeholder="مثلاً پنجشنبه ۲۲ مرداد" value={departure.label} />
                <JalaliDateInput ariaLabel="تاریخ دقیق" className={field} onChange={(value) => updateDeparture({ departureDate: value })} value={departure.departureDate} />
                <input aria-label="تعداد شب" className={field} min={1} onChange={(event) => updateDeparture({ nights: event.target.value ? Number(event.target.value) : null })} placeholder="تعداد شب" type="number" value={departure.nights ?? ""} />
                <button className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50" onClick={() => removeDeparture(index)} type="button">حذف تاریخ</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input aria-label="شناسه نوبت در اکسل" className={field} onChange={(event) => updateDeparture({ externalCode: event.target.value || null })} placeholder="شناسه Excel؛ DEP-001" value={departure.externalCode ?? ""} />
                <input aria-label="شناسه مجموعه قیمت" className={field} onChange={(event) => updateDeparture({ priceSetCode: event.target.value || null })} placeholder="شناسه قیمت؛ PS-SUMMER" value={departure.priceSetCode ?? ""} />
                <JalaliDateInput ariaLabel="تاریخ برگشت این نوبت" className={field} onChange={(value) => updateDeparture({ returnDate: value })} value={departure.returnDate} />
                <select aria-label="وضعیت رزرو نوبت" className={field} onChange={(event) => updateDeparture({ bookingStatus: event.target.value as TourDeparture["bookingStatus"] })} value={departure.bookingStatus}><option value="open">باز و قابل رزرو</option><option value="closed">بسته</option><option value="sold_out">تکمیل ظرفیت</option></select>
                <input aria-label="ظرفیت کل نوبت" className={field} min={0} onChange={(event) => updateDeparture({ capacityTotal: event.target.value ? Number(event.target.value) : null })} placeholder="ظرفیت کل" type="number" value={departure.capacityTotal ?? ""} />
                <div className="rounded-xl border border-border px-3 py-2 text-sm font-bold">باقی‌مانده: {departure.capacityRemaining ?? "نامحدود"}</div>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <fieldset className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3" data-tour-flight-direction="outbound">
                  <legend className={`${tourLegend} text-sm`}>پرواز رفت این تاریخ</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="ایرلاین رفت نوبت" className={field} onChange={(event) => updateDeparture({ outboundAirlineName: event.target.value || null })} placeholder="نام ایرلاین رفت" value={departure.outboundAirlineName ?? ""} />
                    <input aria-label="شماره پرواز رفت نوبت" className={field} onChange={(event) => updateDeparture({ outboundFlightNumber: event.target.value || null })} placeholder="شماره پرواز رفت" value={departure.outboundFlightNumber ?? ""} />
                  </div>
                  <MediaUpload aspect="square" currentId={departure.outboundAirlineLogoImageId} label="لوگوی ایرلاین رفت این تاریخ" onRemoved={() => updateDeparture({ outboundAirlineLogoImageId: null })} onUploaded={(id) => updateDeparture({ outboundAirlineLogoImageId: id })} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="فرودگاه مبدأ رفت" className={field} onChange={(event) => updateDeparture({ outboundOriginAirport: event.target.value || null })} placeholder="فرودگاه مبدأ رفت" value={departure.outboundOriginAirport ?? ""} />
                    <input aria-label="کد فرودگاه مبدأ رفت" className={`${field} uppercase`} dir="ltr" maxLength={3} onChange={(event) => updateDeparture({ outboundOriginAirportCode: event.target.value.toUpperCase() || null })} pattern="[A-Za-z]{3}" placeholder="THR" value={departure.outboundOriginAirportCode ?? ""} />
                    <input aria-label="فرودگاه مقصد رفت" className={field} onChange={(event) => updateDeparture({ outboundDestinationAirport: event.target.value || null })} placeholder="فرودگاه مقصد رفت" value={departure.outboundDestinationAirport ?? ""} />
                    <input aria-label="کد فرودگاه مقصد رفت" className={`${field} uppercase`} dir="ltr" maxLength={3} onChange={(event) => updateDeparture({ outboundDestinationAirportCode: event.target.value.toUpperCase() || null })} pattern="[A-Za-z]{3}" placeholder="IST" value={departure.outboundDestinationAirportCode ?? ""} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ClearableTimeInput className={field} label="حرکت رفت" onChange={(value) => updateDeparture({ outboundDepartureTime: value || null })} value={departure.outboundDepartureTime?.slice(0, 5) ?? ""} />
                    <ClearableTimeInput className={field} label="رسیدن رفت" onChange={(value) => updateDeparture({ outboundArrivalTime: value || null })} value={departure.outboundArrivalTime?.slice(0, 5) ?? ""} />
                    <input aria-label="هواپیمای رفت" className={field} onChange={(event) => updateDeparture({ outboundAircraftName: event.target.value || null })} placeholder="نام یا مدل هواپیمای رفت" value={departure.outboundAircraftName ?? ""} />
                    <input aria-label="کلاس پرواز رفت" className={field} onChange={(event) => updateDeparture({ outboundTravelClass: event.target.value || null })} placeholder="کلاس پرواز رفت" value={departure.outboundTravelClass ?? ""} />
                    <input aria-label="بار مجاز رفت" className={field} min={0} onChange={(event) => updateDeparture({ outboundBaggageAllowanceKg: event.target.value ? Number(event.target.value) : null })} placeholder="بار مجاز رفت (کیلوگرم)" type="number" value={departure.outboundBaggageAllowanceKg ?? ""} />
                  </div>
                </fieldset>
                <fieldset className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3" data-tour-flight-direction="return">
                  <legend className={`${tourLegend} text-sm`}>پرواز برگشت این تاریخ</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="ایرلاین برگشت نوبت" className={field} onChange={(event) => updateDeparture({ returnAirlineName: event.target.value || null })} placeholder="نام ایرلاین برگشت" value={departure.returnAirlineName ?? ""} />
                    <input aria-label="شماره پرواز برگشت نوبت" className={field} onChange={(event) => updateDeparture({ returnFlightNumber: event.target.value || null })} placeholder="شماره پرواز برگشت" value={departure.returnFlightNumber ?? ""} />
                  </div>
                  <MediaUpload aspect="square" currentId={departure.returnAirlineLogoImageId} label="لوگوی ایرلاین برگشت این تاریخ" onRemoved={() => updateDeparture({ returnAirlineLogoImageId: null })} onUploaded={(id) => updateDeparture({ returnAirlineLogoImageId: id })} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="فرودگاه مبدأ برگشت" className={field} onChange={(event) => updateDeparture({ returnOriginAirport: event.target.value || null })} placeholder="فرودگاه مبدأ برگشت" value={departure.returnOriginAirport ?? ""} />
                    <input aria-label="کد فرودگاه مبدأ برگشت" className={`${field} uppercase`} dir="ltr" maxLength={3} onChange={(event) => updateDeparture({ returnOriginAirportCode: event.target.value.toUpperCase() || null })} pattern="[A-Za-z]{3}" placeholder="IST" value={departure.returnOriginAirportCode ?? ""} />
                    <input aria-label="فرودگاه مقصد برگشت" className={field} onChange={(event) => updateDeparture({ returnDestinationAirport: event.target.value || null })} placeholder="فرودگاه مقصد برگشت" value={departure.returnDestinationAirport ?? ""} />
                    <input aria-label="کد فرودگاه مقصد برگشت" className={`${field} uppercase`} dir="ltr" maxLength={3} onChange={(event) => updateDeparture({ returnDestinationAirportCode: event.target.value.toUpperCase() || null })} pattern="[A-Za-z]{3}" placeholder="THR" value={departure.returnDestinationAirportCode ?? ""} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ClearableTimeInput className={field} label="حرکت برگشت" onChange={(value) => updateDeparture({ returnDepartureTime: value || null })} value={departure.returnDepartureTime?.slice(0, 5) ?? ""} />
                    <ClearableTimeInput className={field} label="رسیدن برگشت" onChange={(value) => updateDeparture({ returnArrivalTime: value || null })} value={departure.returnArrivalTime?.slice(0, 5) ?? ""} />
                    <input aria-label="هواپیمای برگشت" className={field} onChange={(event) => updateDeparture({ returnAircraftName: event.target.value || null })} placeholder="نام یا مدل هواپیمای برگشت" value={departure.returnAircraftName ?? ""} />
                    <input aria-label="کلاس پرواز برگشت" className={field} onChange={(event) => updateDeparture({ returnTravelClass: event.target.value || null })} placeholder="کلاس پرواز برگشت" value={departure.returnTravelClass ?? ""} />
                    <input aria-label="بار مجاز برگشت" className={field} min={0} onChange={(event) => updateDeparture({ returnBaggageAllowanceKg: event.target.value ? Number(event.target.value) : null })} placeholder="بار مجاز برگشت (کیلوگرم)" type="number" value={departure.returnBaggageAllowanceKg ?? ""} />
                  </div>
                </fieldset>
              </div>
              <button type="button" className="rounded-xl border border-brand px-3 py-2 text-sm font-bold" disabled={!departure.departureDate} onClick={() => {
                onDeparturesChange([...departures, emptyDeparture(departure.departureDate)]);
                setSelectedDepartureIndex(departures.length);
              }}>افزودن مدت اقامت برای همین تاریخ</button>
              <button className="rounded-xl border border-brand px-3 py-2 text-sm font-bold text-brand" onClick={() => { const copy = { ...departure, id: undefined, externalCode: departure.externalCode ? `${departure.externalCode}-COPY` : null, label: `${departure.label} - هفته بعد`, departureDate: shiftIsoDate(departure.departureDate, 7), returnDate: shiftIsoDate(departure.returnDate, 7), capacityRemaining: departure.capacityTotal, hotelPrices: departure.hotelPrices.map((offer) => ({ ...offer, id: undefined, capacityRemaining: offer.capacityTotal })) }; onDeparturesChange([...departures, copy]); setSelectedDepartureIndex(departures.length); }} type="button">کپی همین نوبت برای هفته بعد</button>
              <strong className={`${tourHeaderBox} block text-sm`}>هتل‌ها و اتاق‌های این تاریخ</strong>
              {departure.hotelPrices.map((offer, offerIndex) => {
                const updateOffer = (changes: Partial<typeof offer>) =>
                  updateDeparture({
                    hotelPrices: departure.hotelPrices.map((item, itemIndex) =>
                      itemIndex === offerIndex ? { ...item, ...changes } : item,
                    ),
                  });
                return (
                  <div className="space-y-3 rounded-xl bg-surface-muted p-4" data-tour-hotel-card key={offer.id ?? offerIndex}>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <select aria-label="هتل" className={field} onChange={(event) => updateOffer({ hotelId: Number(event.target.value), hotel: undefined })} value={offer.hotelId ?? offer.hotel?.id ?? ""}>
                        {hotelOptionsFor(offer.hotelId ?? offer.hotel?.id).map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}
                      </select>
                      <label className="grid min-w-0 gap-1 text-xs font-bold">
                        <span>نام اتاق</span>
                        <input aria-label="نام اتاق" className={field} maxLength={80} onChange={(event) => updateOffer({ roomType: event.target.value })} placeholder="مثلاً Standard / Deluxe / Sea View" value={offer.roomType ?? ""} />
                        <span className="font-normal leading-5 text-muted">از ستون room یا نوع اتاق در اکسل خوانده می‌شود و اینجا قابل ویرایش است.</span>
                      </label>
                      <input aria-label="نوع خدمات" className={field} onChange={(event) => updateOffer({ serviceType: event.target.value })} placeholder="BB / ALL / UALL" value={offer.serviceType} />
                      <label className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-bold">
                        <input checked={offer.isAvailable !== false} className="size-4 accent-emerald-600" onChange={(event) => updateOffer({ isAvailable: event.target.checked })} type="checkbox" />
                        ظرفیت دارد
                      </label>
                      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
                        <button
                          className="text-sm font-bold text-brand"
                          onClick={() => updateDeparture({
                            hotelPrices: [
                              ...departure.hotelPrices,
                              createHotelOffer(offer.hotelId ?? offer.hotel?.id ?? hotels[0]?.id ?? 0, false, departure.priceSetCode),
                            ],
                          })}
                          type="button"
                        >
                          + اتاق دیگر برای همین هتل
                        </button>
                        <button className="text-sm font-bold text-red-700" onClick={() => updateDeparture({ hotelPrices: departure.hotelPrices.filter((_, itemIndex) => itemIndex !== offerIndex) })} type="button">حذف این اتاق</button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <input aria-label={"\u0634\u0646\u0627\u0633\u0647 \u0642\u06cc\u0645\u062a Excel \u0647\u062a\u0644"} className={field} maxLength={64} onChange={(event) => updateOffer({ externalPriceCode: event.target.value || null })} placeholder={"\u0634\u0646\u0627\u0633\u0647 \u0642\u06cc\u0645\u062a Excel"} value={offer.externalPriceCode ?? ""} />
                      <input aria-label={"\u0634\u0646\u0627\u0633\u0647 \u0645\u062c\u0645\u0648\u0639\u0647 \u0642\u06cc\u0645\u062a \u0647\u062a\u0644"} className={field} maxLength={64} onChange={(event) => updateOffer({ priceSetCode: event.target.value || null })} placeholder={"\u0634\u0646\u0627\u0633\u0647 \u0645\u062c\u0645\u0648\u0639\u0647 \u0642\u06cc\u0645\u062a"} value={offer.priceSetCode ?? ""} />
                      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-bold">
                        <input
                          checked={offer.isBasePackage}
                          className="size-4 accent-brand"
                          onChange={(event) =>
                            updateDeparture({
                              hotelPrices: departure.hotelPrices.map((item, itemIndex) => ({
                                ...item,
                                isBasePackage: itemIndex === offerIndex ? event.target.checked : false,
                              })),
                            })
                          }
                          type="checkbox"
                        />
                        {"\u0647\u062a\u0644 \u067e\u0627\u06cc\u0647 \u067e\u06a9\u06cc\u062c"}
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs font-bold text-brand">ظرفیت کل اتاق برای این تاریخ<input aria-label="ظرفیت کل" className={`${field} mt-1`} min={0} onChange={(event) => updateOffer({ capacityTotal: event.target.value === "" ? null : Number(event.target.value) })} placeholder="خالی = نامحدود" type="number" value={offer.capacityTotal ?? ""} /></label>
                      <div className={`rounded-xl border p-3 text-sm font-black ${offer.capacityRemaining === 0 || offer.isAvailable === false ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                        {offer.capacityRemaining === null || offer.capacityRemaining === undefined ? "ظرفیت نامحدود / ثبت‌نشده" : offer.capacityRemaining > 0 ? `ظرفیت باقی‌مانده: ${offer.capacityRemaining.toLocaleString("fa-IR")} اتاق` : "تکمیل ظرفیت"}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <input aria-label="قیمت دبل" className={field} min={0} onChange={(event) => updateOffer({ doublePrice: event.target.value })} placeholder="قیمت دبل" step="any" type="number" value={offer.doublePrice} />
                        <CurrencySelect aria-label="ارز دبل" className={field} onChange={(event) => updateOffer({ doubleCurrency: event.target.value })} value={offer.doubleCurrency ?? offer.packageCurrency} />
                      </div>
                      <div className="grid gap-2">
                        <input aria-label="قیمت سینگل" className={field} min={0} onChange={(event) => updateOffer({ singlePrice: event.target.value })} placeholder="قیمت سینگل" step="any" type="number" value={offer.singlePrice} />
                        <CurrencySelect aria-label="ارز سینگل" className={field} onChange={(event) => updateOffer({ singleCurrency: event.target.value })} value={offer.singleCurrency ?? offer.packageCurrency} />
                      </div>
                      <div className="grid gap-2">
                        <input aria-label="قیمت کودک با تخت" className={field} min={0} onChange={(event) => updateOffer({ childWithBedPrice: event.target.value })} placeholder="کودک با تخت" step="any" type="number" value={offer.childWithBedPrice} />
                        <CurrencySelect aria-label="ارز کودک با تخت" className={field} onChange={(event) => updateOffer({ childWithBedCurrency: event.target.value })} value={offer.childWithBedCurrency ?? offer.packageCurrency} />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <input aria-label="قیمت کودک بدون تخت" className={field} min={0} onChange={(event) => updateOffer({ childWithoutBedPrice: event.target.value })} placeholder="کودک بدون تخت" step="any" type="number" value={offer.childWithoutBedPrice} />
                      <input aria-label="قیمت نوزاد" className={field} min={0} onChange={(event) => updateOffer({ infantPrice: event.target.value })} placeholder="نوزاد" step="any" type="number" value={offer.infantPrice} />
                      <input aria-label="هزینه پرواز هر نفر برای دبل و سینگل" className={field} min={0} onChange={(event) => updateOffer({ flightPricePerPerson: event.target.value })} placeholder="پرواز هر نفر برای دبل و سینگل" step="any" type="number" value={offer.flightPricePerPerson} />
                      <input aria-label="هزینه پرواز کودک با تخت" className={field} min={0} onChange={(event) => updateOffer({ childWithBedFlightPrice: event.target.value || null })} placeholder="پرواز کودک با تخت" step="any" type="number" value={offer.childWithBedFlightPrice ?? ""} />
                      <CurrencySelect aria-label="ارز پرواز کودک با تخت" className={field} onChange={(event) => updateOffer({ childWithBedFlightCurrency: event.target.value })} value={offer.childWithBedFlightCurrency ?? "IRT"} />
                      <CurrencySelect aria-label="ارز پرواز" className={field} onChange={(event) => updateOffer({ flightCurrency: event.target.value })} value={offer.flightCurrency} />
                      <CurrencySelect aria-label={"\u0627\u0631\u0632 \u06a9\u0648\u062f\u06a9 \u0628\u062f\u0648\u0646 \u062a\u062e\u062a"} className={field} onChange={(event) => updateOffer({ childWithoutBedCurrency: event.target.value })} value={offer.childWithoutBedCurrency} />
                      <CurrencySelect aria-label={"\u0627\u0631\u0632 \u0646\u0648\u0632\u0627\u062f"} className={field} onChange={(event) => updateOffer({ infantCurrency: event.target.value })} value={offer.infantCurrency} />
                    </div>
                    <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-6 text-sky-900">
                      پرواز هر نفر فقط به دبل و سینگل اضافه می‌شود. قیمت کودک با تخت با هزینه پرواز مخصوص خودش جمع می‌شود؛ ستون خالی یعنی بدون هزینه اضافه.
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })() : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">هنوز تاریخی ثبت نشده است؛ از دکمه افزودن استفاده کنید.</p>}
      </Collection>
      <label className="grid gap-1 text-sm font-bold">
        <span>جست‌وجوی هتل قابل انتخاب</span>
        <input className={field} onChange={(event) => setHotelQuery(event.target.value)} placeholder="نام هتل، شهر یا شناسه هتل را بنویسید..." type="search" value={hotelQuery} />
      </label>
      <section className="space-y-3 rounded-xl border border-border p-3" data-tour-section="hotel-selection">
        <div className={`${tourHeaderBox} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <strong className="block">{"\u0627\u0646\u062a\u062e\u0627\u0628 \u0647\u0645\u200c\u0632\u0645\u0627\u0646 \u0647\u062a\u0644\u200c\u0647\u0627"}</strong>
            <span className="text-xs text-muted">
              {selectedHotelIds.length.toLocaleString("fa-IR")} {"\u0647\u062a\u0644 \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u062f\u0647"}
            </span>
          </div>
          <button
            className="rounded-xl border border-brand px-3 py-2 text-sm font-bold text-brand disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selectedDeparture || !selectedHotelIds.length}
            onClick={addSelectedHotelsToActiveDeparture}
            type="button"
          >
            {"\u0627\u0641\u0632\u0648\u062f\u0646 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0647\u0627 \u0628\u0647 \u0646\u0648\u0628\u062a \u0641\u0639\u0627\u0644"}
          </button>
        </div>
        <div aria-label={"\u0641\u0647\u0631\u0633\u062a \u0647\u062a\u0644\u200c\u0647\u0627\u06cc \u0642\u0627\u0628\u0644 \u0627\u0646\u062a\u062e\u0627\u0628"} className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3" role="group">
          {filteredHotels.map((hotel) => (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm transition hover:border-brand/50" key={hotel.id}>
              <input
                checked={selectedHotelIds.includes(hotel.id)}
                className="mt-1 size-4 accent-brand"
                onChange={(event) =>
                  setSelectedHotelIds((current) =>
                    event.target.checked
                      ? [...current, hotel.id]
                      : current.filter((hotelId) => hotelId !== hotel.id),
                  )
                }
                type="checkbox"
              />
              <span>
                <strong className="block">{hotel.name}</strong>
                <span className="mt-1 block text-xs text-muted">
                  {[hotel.city, hotel.region, `${hotel.starRating.toLocaleString("fa-IR")} \u0633\u062a\u0627\u0631\u0647`, hotel.hotelCode]
                    .filter(Boolean)
                    .join(" \u00b7 ")}
                </span>
              </span>
            </label>
          ))}
          {!filteredHotels.length ? <p className="text-sm text-muted">{"\u0647\u062a\u0644\u06cc \u0645\u0637\u0627\u0628\u0642 \u062c\u0633\u062a\u200c\u0648\u062c\u0648 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f."}</p> : null}
        </div>
      </section>
      <fieldset className="space-y-3 rounded-xl border border-border p-3" data-tour-section="availability-range">
        <legend className={tourLegend}>{"\u0628\u0627\u0632 \u06cc\u0627 \u0628\u0633\u062a\u0647\u200c\u06a9\u0631\u062f\u0646 \u0647\u062a\u0644 \u062f\u0631 \u0628\u0627\u0632\u0647 \u062a\u0627\u0631\u06cc\u062e"}</legend>
        <p className="text-xs leading-6 text-muted">{"\u0627\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0641\u0642\u0637 \u0648\u0636\u0639\u06cc\u062a \u0641\u0631\u0648\u0634 \u0647\u062a\u0644 \u0631\u0627 \u062f\u0631 \u0646\u0648\u0628\u062a\u200c\u0647\u0627\u06cc \u0645\u0648\u062c\u0648\u062f \u0647\u0645\u0627\u0646 \u0628\u0627\u0632\u0647 \u062a\u063a\u06cc\u06cc\u0631 \u0645\u06cc\u200c\u062f\u0647\u062f \u0648 \u0638\u0631\u0641\u06cc\u062a \u0645\u0635\u0631\u0641\u200c\u0634\u062f\u0647 \u0631\u0627 \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06cc \u0646\u0645\u06cc\u200c\u06a9\u0646\u062f."}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <JalaliDateInput ariaLabel={"\u0634\u0631\u0648\u0639 \u0628\u0627\u0632\u0647 \u062a\u063a\u06cc\u06cc\u0631 \u0648\u0636\u0639\u06cc\u062a \u0647\u062a\u0644"} className={field} onChange={setRangeStartDate} value={rangeStartDate} />
          <JalaliDateInput ariaLabel={"\u067e\u0627\u06cc\u0627\u0646 \u0628\u0627\u0632\u0647 \u062a\u063a\u06cc\u06cc\u0631 \u0648\u0636\u0639\u06cc\u062a \u0647\u062a\u0644"} className={field} onChange={setRangeEndDate} value={rangeEndDate} />
          <select aria-label={"\u0647\u062a\u0644 \u0647\u062f\u0641 \u062f\u0631 \u0628\u0627\u0632\u0647"} className={field} onChange={(event) => setRangeHotelId(event.target.value)} value={rangeHotelId}>
            <option value="all">{"\u0647\u0645\u0647 \u0647\u062a\u0644\u200c\u0647\u0627"}</option>
            {hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-40" disabled={!rangeStartDate || !rangeEndDate} onClick={() => applyHotelAvailability(false)} type="button">{"\u0628\u0633\u062a\u0646 \u062f\u0631 \u0628\u0627\u0632\u0647"}</button>
          <button className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-40" disabled={!rangeStartDate || !rangeEndDate} onClick={() => applyHotelAvailability(true)} type="button">{"\u0628\u0627\u0632\u06a9\u0631\u062f\u0646 \u062f\u0631 \u0628\u0627\u0632\u0647"}</button>
        </div>
      </fieldset>
    </>
  );
}

function createHotelOffer(
  hotelId: number,
  isBasePackage = false,
  priceSetCode: string | null = null,
): TourDeparture["hotelPrices"][number] {
  return {
    hotelId,
    roomType: "Standard",
    serviceType: "BB",
    externalPriceCode: null,
    priceSetCode,
    doublePrice: "0",
    singlePrice: "0",
    childWithBedPrice: "0",
    packageCurrency: "USD",
    childWithoutBedPrice: "0",
    childWithoutBedCurrency: "USD",
    infantPrice: "0",
    infantCurrency: "IRT",
    flightPricePerPerson: "0",
    flightCurrency: "IRT",
    isAvailable: true,
    isBasePackage,
    capacityTotal: null,
    capacityRemaining: null,
  };
}

function shiftIsoDate(value: string | null, days: number): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function Collection({ title, addLabel = "افزودن", onAdd, children }: { title: string; addLabel?: string; onAdd: () => void; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white shadow-[0_8px_24px_rgba(1,37,105,0.06)]"><div className="flex items-center justify-between border-b-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950"><strong>{title}</strong><button className="rounded-xl border border-brand/30 bg-white px-3 py-2 text-sm font-black text-brand shadow-sm transition hover:border-brand hover:bg-brand hover:text-white" onClick={onAdd} type="button">+ {addLabel}</button></div><div className="space-y-4 p-4">{children}</div></section>;
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <button aria-label="حذف" className="px-2 font-bold text-red-700" onClick={onClick} type="button">×</button>;
}
