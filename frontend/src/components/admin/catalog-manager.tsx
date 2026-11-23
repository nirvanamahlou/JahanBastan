"use client";

import { slugOnTitleEdit } from "@/lib/title-slug";
import { AutoSlugInput } from "@/components/admin/auto-slug-input";

import { Time24Input } from "@/components/ui/time-24-input";

import { type FormEvent, useEffect, useState } from "react";

import { CreateItemButton } from "@/components/admin/create-item-button";
import { CombinedTourPackageFields } from "@/components/admin/combined-tour-package-fields";

import { InternalNoteField } from "@/components/admin/internal-note-field";

import { CurrencySelect } from "@/components/admin/currency-select";
import { MediaUpload } from "@/components/admin/media-upload";
import { GalleryField } from "@/components/admin/gallery-field";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import { StructuredTourFields } from "@/components/admin/structured-tour-fields";
import { AvinaTourEditor, type AvinaTourEditorial } from "./avina-tour-manager";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { copyTourForCreate } from "@/lib/copy-tour";
import { adminClientFetch } from "@/lib/admin-client";
import { adminErrorText } from "@/lib/admin-error";
import { formatTravelDuration } from "@/lib/travel-duration";
import type {
  DestinationOption,
  HotelOption,
  ManagedTour,
  ManagedTravelService,
  TourDeparture,
  TourCombinedPackage,
  TourHotelPackage,
  TourItineraryDay,
  TourTravelLeg,
} from "@/types/editorial";

const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const tourHeaderBox =
  "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950";
const tourLegend =
  "mx-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-black text-emerald-950";

const transportLabels: Record<string, string> = {
  flight: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
};

const categoryOptions: Record<string, Array<[string, string]>> = {
  flight: [["scheduled", "پرواز سیستمی"], ["charter", "پرواز چارتر"], ["promotional", "پرواز ویژه یا تخفیفی"]],
  train: [["passenger", "قطار مسافری"], ["high_speed", "قطار سریع‌السیر"], ["overnight", "قطار شب‌رو"]],
  bus: [["standard", "اتوبوس عادی"], ["vip", "اتوبوس VIP"], ["sleeper", "اتوبوس تخت‌شو"]],
};

function buildTransportTitle(serviceType: string, origin: string, destination: string, provider: string) {
  const route = origin && destination ? `${origin} به ${destination}` : origin || destination;
  return [`بلیت ${transportLabels[serviceType] ?? "سفر"}`, route, provider ? `با ${provider}` : ""].filter(Boolean).join(" ");
}

function inclusiveTripDays(departureDate?: string | null, returnDate?: string | null) {
  if (!departureDate || !returnDate) return null;
  const start = new Date(`${departureDate}T12:00:00Z`);
  const end = new Date(`${returnDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function TourManager({ initialItems, hotels, destinations, transportServices, initialLoadError, initialAvinaTours = [], avinaLoadFailed = false }: { initialAvinaTours?: AvinaTourEditorial[]; avinaLoadFailed?: boolean; initialItems: ManagedTour[]; hotels: HotelOption[]; destinations: DestinationOption[]; transportServices: ManagedTravelService[]; initialLoadError?: string }) {
  const [items, setItems] = useState(initialItems);
  const [avinaTours, setAvinaTours] = useState(initialAvinaTours);
  const [avinaEditing, setAvinaEditing] = useState<string | null>(null);
  const avinaKey = (tour: AvinaTourEditorial) => tour.kind + ":" + tour.resourceId;
  const selectedAvina = avinaTours.find(tour => avinaKey(tour) === avinaEditing);
  const [editing, setEditing] = useState<ManagedTour | null>(null);
  const [copying, setCopying] = useState(false);
  const creating = copying || !editing;
  const [bestTravelTime, setBestTravelTime] = useState("");
  const [imageId, setImageId] = useState<number | null>(null);
  const [galleryImageIds, setGalleryImageIds] = useState<number[]>([]);
  const [travelLegs, setTravelLegs] = useState<TourTravelLeg[]>([]);
  const [itineraryDays, setItineraryDays] = useState<TourItineraryDay[]>([]);
  const [departures, setDepartures] = useState<TourDeparture[]>([]);
  const [hotelPackages, setHotelPackages] = useState<TourHotelPackage[]>([]);
  const [combinedPackages, setCombinedPackages] = useState<TourCombinedPackage[]>([]);
  const [isCombinedStay, setIsCombinedStay] = useState(false);
  const [message, setMessage] = useState(initialLoadError ?? "");
  const [busy, setBusy] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const previewDeparture = [...departures]
    .sort((first, second) =>
      (first.departureDate ?? "9999").localeCompare(
        second.departureDate ?? "9999",
      ),
    )[0];
  const calculatedDurationDays =
    inclusiveTripDays(
      previewDeparture?.departureDate,
      previewDeparture?.returnDate,
    ) ?? (previewDeparture?.nights ? previewDeparture.nights + 1 : null);
  const displayedDurationDays = calculatedDurationDays ?? editing?.durationDays ?? null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    const form = new FormData(formElement);
    const nullableNumber = (name: string) => form.get(name) ? Number(form.get(name)) : null;
    const orderedDepartures = [...departures].sort((first, second) => {
      if (!first.departureDate) return 1;
      if (!second.departureDate) return -1;
      return first.departureDate.localeCompare(second.departureDate);
    });
    const primaryDeparture = orderedDepartures[0] ?? null;
    const primaryOffer = primaryDeparture?.hotelPrices.find((offer) => offer.isBasePackage)
      ?? primaryDeparture?.hotelPrices[0]
      ?? null;
    const primaryHotelId = primaryOffer?.hotelId ?? primaryOffer?.hotel?.id ?? editing?.hotelId ?? null;
    const primaryHotel = hotels.find((hotel) => hotel.id === primaryHotelId);
    const primaryHotelName = primaryOffer?.hotel?.name ?? primaryHotel?.name ?? editing?.hotelName ?? null;
    const manualDurationDays = nullableNumber("durationDays");
    const projectedDurationDays = manualDurationDays ?? inclusiveTripDays(
      primaryDeparture?.departureDate,
      primaryDeparture?.returnDate,
    ) ?? (primaryDeparture?.nights ? primaryDeparture.nights + 1 : editing?.durationDays ?? null);
    const manualFlightPriceAmount = nullableNumber("flightPriceAmount");
    const manualFlightPriceCurrency = String(
      form.get("flightPriceCurrency") || "",
    );
    const capacities = departures
      .map((departure) => departure.capacityTotal)
      .filter((capacity): capacity is number => typeof capacity === "number" && capacity > 0);
    const projectedMaxPassengers = capacities.length
      ? Math.max(...capacities)
      : editing?.maxPassengers ?? null;
    const payload = {
      title: form.get("title"),
      slug: creating ? form.get("slug") : slugOnTitleEdit(form.get("title"), editing?.title, 200),
      destinationId: nullableNumber("destinationId"),
      hotelId: primaryHotelId,
      hotelName: primaryHotelName,
      imageId,
      galleryImageIds,
      origin: form.get("origin") || null,
      tourType: form.get("tourType") || null,
      durationDays: projectedDurationDays,
      departureDate: primaryDeparture?.departureDate ?? editing?.departureDate ?? null,
      priceAmount: primaryOffer?.doublePrice ?? primaryDeparture?.priceAmount ?? editing?.priceAmount ?? null,
      currency: primaryOffer?.doubleCurrency ?? primaryOffer?.packageCurrency ?? primaryDeparture?.currency ?? editing?.currency ?? "IRT",
      transportation: form.get("transportation") || null,
      originAirport: primaryDeparture?.outboundOriginAirport ?? editing?.originAirport ?? null,
      originAirportCode: primaryDeparture?.outboundOriginAirportCode ?? editing?.originAirportCode ?? null,
      destinationAirport: primaryDeparture?.outboundDestinationAirport ?? editing?.destinationAirport ?? null,
      destinationAirportCode: primaryDeparture?.outboundDestinationAirportCode ?? editing?.destinationAirportCode ?? null,
      airlineName: primaryDeparture?.outboundAirlineName ?? editing?.airlineName ?? null,
      airlineLogoImageId: primaryDeparture?.outboundAirlineLogoImageId ?? editing?.airlineLogoImageId ?? null,
      flightNumber: primaryDeparture?.outboundFlightNumber ?? editing?.flightNumber ?? null,
      departureTime: primaryDeparture?.outboundDepartureTime ?? editing?.departureTime ?? null,
      arrivalTime: primaryDeparture?.outboundArrivalTime ?? editing?.arrivalTime ?? null,
      baggageAllowanceKg: primaryDeparture?.outboundBaggageAllowanceKg ?? editing?.baggageAllowanceKg ?? null,
      aircraftName: primaryDeparture?.outboundAircraftName ?? editing?.aircraftName ?? null,
      travelClass: primaryDeparture?.outboundTravelClass ?? editing?.travelClass ?? null,
      returnDate: primaryDeparture?.returnDate ?? editing?.returnDate ?? null,
      returnOriginAirport: primaryDeparture?.returnOriginAirport ?? editing?.returnOriginAirport ?? null,
      returnOriginAirportCode: primaryDeparture?.returnOriginAirportCode ?? editing?.returnOriginAirportCode ?? null,
      returnDestinationAirport: primaryDeparture?.returnDestinationAirport ?? editing?.returnDestinationAirport ?? null,
      returnDestinationAirportCode: primaryDeparture?.returnDestinationAirportCode ?? editing?.returnDestinationAirportCode ?? null,
      returnAirlineName: primaryDeparture?.returnAirlineName ?? editing?.returnAirlineName ?? null,
      returnAirlineLogoImageId: primaryDeparture?.returnAirlineLogoImageId ?? editing?.returnAirlineLogoImageId ?? null,
      returnFlightNumber: primaryDeparture?.returnFlightNumber ?? editing?.returnFlightNumber ?? null,
      returnDepartureTime: primaryDeparture?.returnDepartureTime ?? editing?.returnDepartureTime ?? null,
      returnArrivalTime: primaryDeparture?.returnArrivalTime ?? editing?.returnArrivalTime ?? null,
      returnBaggageAllowanceKg: primaryDeparture?.returnBaggageAllowanceKg ?? editing?.returnBaggageAllowanceKg ?? null,
      returnAircraftName: primaryDeparture?.returnAircraftName ?? editing?.returnAircraftName ?? null,
      returnTravelClass: primaryDeparture?.returnTravelClass ?? editing?.returnTravelClass ?? null,
      destinationLanguage: form.get("destinationLanguage") || null,
      destinationCurrency: form.get("destinationCurrency") || null,
      bestTravelTime: bestTravelTime.trim() || null,
      ratingScore: nullableNumber("ratingScore"),
      ratingCount: Number(form.get("ratingCount") || 0),
      summary: form.get("summary") || null,
      metaTitle: form.get("metaTitle") || null,
      metaDescription: form.get("metaDescription") || null,
      description: form.get("description") || null,
      itinerary: editing?.itinerary ?? null,
      includedServices: form.get("includedServices") || null,
      excludedServices: form.get("excludedServices") || null,
      requiredDocuments: form.get("requiredDocuments") || null,
      tourNotes: form.get("tourNotes") || null,
      refundPolicy: form.get("refundPolicy") || null,
      installmentTerms: form.get("installmentTerms") || null,
      imageAltText: form.get("imageAltText") || null,
      flightIncluded: form.get("flightIncluded") === "on",
      airportTransferIncluded: form.get("airportTransferIncluded") === "on",
      isCombinedStay,
      flightPriceAmount: manualFlightPriceAmount ?? primaryOffer?.flightPricePerPerson ?? null,
      flightPriceCurrency: manualFlightPriceCurrency || primaryOffer?.flightCurrency || "IRT",
      internalNote: form.get("internalNote") || null,
      stayNights: primaryDeparture?.nights ?? editing?.stayNights ?? null,
      maxPassengers: projectedMaxPassengers,
      travelLegs,
      itineraryDays,
      departures,
      hotelPackages: hotelPackages.map(({ hotel: _hotel, ...item }) => ({
        ...item,
        hotelId: item.hotelId ?? _hotel?.id,
      })),
      combinedPackages: combinedPackages.map((combinedPackage, index) => ({
        ...combinedPackage,
        title:
          combinedPackage.title.trim() ||
          `پکیج ترکیبی ${(index + 1).toLocaleString("fa-IR")}`,
      })),
      availabilityStatus: form.get("availabilityStatus"),
      status: form.get("status"),
      isHomeRecommended: form.get("isHomeRecommended") === "on",
      isFeatured: form.get("isFeatured") === "on",
      isInstallmentAvailable: form.get("isInstallmentAvailable") === "on",
      isDirectFlight: form.get("isDirectFlight") === "on",
      isLastMinute: form.get("isLastMinute") === "on",
      badgeLabel: form.get("badgeLabel") || null,
      displayOrder: Number(form.get("displayOrder") || 0),
    };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await adminClientFetch(`/tours${!creating && editing ? `/${editing.id}` : ""}`, {
        method: creating ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        setMessage(await adminErrorText(response, "تور"));
        return;
      }
      const saved = (await response.json()) as ManagedTour;
      setItems((current) => creating ? [saved, ...current] : current.map((item) => item.id === saved.id ? saved : item));
      setCopying(false);
      setEditing(null);
      setBestTravelTime("");
      setImageId(null);
      setGalleryImageIds([]);
      setTravelLegs([]);
      setItineraryDays([]);
      setDepartures([]);
      setHotelPackages([]);
      setCombinedPackages([]);
      setIsCombinedStay(false);
      setEditorVersion((current) => current + 1);
      formElement.reset();
      setMessage("تور ذخیره شد.");
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "پاسخی از سرور دریافت نشد. سلامت Backend و Migrationها را بررسی کنید."
          : "ارتباط با سرور برقرار نشد. Backend در دسترس نیست یا درخواست توسط مرورگر مسدود شده است.",
      );
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  function startEdit(item: ManagedTour) {
    setCopying(false);
    setEditorVersion((current) => current + 1);
    setMessage("");
    setEditing(item);
    setBestTravelTime(item.bestTravelTime ?? "");
    setImageId(item.imageId);
    setGalleryImageIds(item.galleryImageIds);
    setTravelLegs(item.travelLegs);
    setItineraryDays(item.itineraryDays);
    setDepartures(item.departures);
    setHotelPackages(item.hotelPackages);
    setCombinedPackages(item.combinedPackages ?? []);
    setIsCombinedStay(item.isCombinedStay);
  }

  function startCopy(item: ManagedTour) {
    startEdit(copyTourForCreate(item, items.map((tour) => tour.slug)));
    setCopying(true);
    setMessage("نسخه کپی آماده است؛ اطلاعات را ویرایش کنید و به‌عنوان تور جدید ذخیره کنید. ارتباط اکسل تور اصلی منتقل نمی‌شود.");
    window.requestAnimationFrame(() => document.getElementById("admin-tour-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function resetEditor() {
    setCopying(false);
    setEditing(null);
    setBestTravelTime("");
    setImageId(null);
    setGalleryImageIds([]);
    setTravelLegs([]);
    setItineraryDays([]);
    setDepartures([]);
    setHotelPackages([]);
    setCombinedPackages([]);
    setIsCombinedStay(false);
    setEditorVersion((current) => current + 1);
    setMessage("");
  }

  async function archive(id: number) {
    if (!window.confirm("این تور برای همیشه از دیتابیس حذف شود؟ این عمل قابل بازگردانی نیست.")) return;
    const response = await adminClientFetch(`/tours/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("تور برای همیشه حذف شد.");
    } else {
      setMessage(await adminErrorText(response, "حذف تور ناموفق بود."));
    }
  }

  return (
    <ManagerLayout<number | string>
      accentHeader
      listWarning={avinaLoadFailed ? "دریافت تورهای آوینا انجام نشد." : undefined}
      onCopy={(id) => { const item = items.find((tour) => tour.id === id); if (item) { setAvinaEditing(null); startCopy(item); } }}
      form={selectedAvina ? <AvinaTourEditor key={avinaKey(selectedAvina)} tour={selectedAvina}
        onClose={() => setAvinaEditing(null)}
        onSave={updated => setAvinaTours(current => current.map(tour => avinaKey(tour) === avinaKey(updated) ? updated : tour))}
      /> :
        <form data-admin-save-form className="tour-admin-form space-y-4 rounded-2xl border border-border bg-surface p-5" id="admin-tour-form" key={`${editing?.id ?? "new"}-${editorVersion}`} onSubmit={save}>
          <div className={`${tourHeaderBox} flex flex-wrap items-center justify-between gap-3`}>
            <h2 className="text-xl font-black">{copying ? "کپی تور؛ ایجاد تور جدید" : editing ? "ویرایش تور" : "تور جدید"}</h2>
            {editing && !copying ? <a className="rounded-lg border border-brand px-3 py-1.5 text-sm font-bold text-brand hover:bg-brand hover:text-white" href={`/admin-gateway/admin/tours/${editing.id}/package.pdf`}>دانلود PDF پکیج</a> : null}<CreateItemButton formId="admin-tour-form" label="تور" onCreate={resetEditor} />
          </div>
          <section className="scroll-mt-6 space-y-4 rounded-2xl border border-border bg-white p-4" id="admin-tour-media">
            <div className={tourHeaderBox}><h3 className="font-black">تصویر کاور و گالری تور</h3><p className="mt-1 text-xs leading-6 text-muted">تصویر افقی به‌عنوان کاور بالای صفحه تور نمایش داده می‌شود؛ تصاویر دیگر را در گالری اضافه کنید.</p></div>
            <MediaUpload aspect="wide" currentId={imageId} label={editing?.title ?? "تصویر کاور تور"} onRemoved={() => setImageId(null)} onUploaded={setImageId} />
            <GalleryField imageIds={galleryImageIds} label="گالری تور" onChange={setGalleryImageIds} />
            <input className={field} defaultValue={editing?.imageAltText ?? ""} maxLength={255} name="imageAltText" placeholder="متن جایگزین تصویر اصلی برای SEO و دسترسی‌پذیری" />
          </section>
          <input className={field} defaultValue={editing?.title} name="title" placeholder="عنوان تور" required />
          {creating ? <AutoSlugInput className={field} name="slug" defaultValue={copying ? editing?.slug : ""} maxLength={200} /> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={field} defaultValue={editing?.origin ?? ""} name="origin" placeholder="مبدأ" />
            <input className={field} defaultValue={editing?.tourType ?? ""} name="tourType" placeholder="نوع تور" />
          </div>
          <select className={field} defaultValue={editing?.destinationId ?? ""} name="destinationId" required>
            <option value="">انتخاب مقصد</option>
            {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.title}{destination.status !== "published" ? " (منتشرنشده)" : ""}</option>)}
          </select>
          <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-6 text-sky-900">
            تاریخ، مدت، ظرفیت، هتل و قیمت نمایشی تور از اولین نوبت معتبر و «هتل پایه پکیج» ساخته می‌شوند؛ اطلاعات پرواز نیز از همان نوبت خوانده می‌شود.
          </p>
          <label className="space-y-1 text-xs font-bold">
            <span>مدت سفر (روز)</span>
            <input
              className={field}
              max={365}
              min={1}
              name="durationDays"
              defaultValue={editing?.durationDays ?? ""}
              placeholder={displayedDurationDays ? `مقدار فعلی/خودکار: ${displayedDurationDays.toLocaleString("fa-IR")} روز` : "مثلاً ۸؛ خالی = محاسبه از تاریخ رفت و برگشت"}
              type="number"
            />
            <span className="block font-normal leading-6 text-muted">
              اختیاری است؛ در حالت خالی از تاریخ رفت و برگشت یا تعداد شب اولین نوبت محاسبه می‌شود.
            </span>
          </label>
          <div className="grid gap-2">
            <label className="space-y-1 text-xs font-bold">
              <span>حمل‌ونقل تور</span>
              <input
                className={field}
                defaultValue={editing?.transportation ?? ""}
                list="tour-transport-services"
                name="transportation"
                placeholder="انتخاب از خدمات سفر یا ورود دستی"
              />
              <datalist id="tour-transport-services">
                {transportServices.map((service) => (
                  <option key={service.id} label={`${service.serviceType} · ${service.title}`} value={service.title} />
                ))}
              </datalist>
            </label>
          </div>
          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className={tourLegend}>اطلاعات مقصد</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} defaultValue={editing?.destinationLanguage ?? ""} maxLength={80} name="destinationLanguage" placeholder="زبان مقصد، مثلاً ترکی" />
              <CurrencySelect className={field} defaultValue={editing?.destinationCurrency ?? editing?.currency ?? "IRT"} label="واحد پول مقصد" name="destinationCurrency" />
            </div>
            <label className="space-y-1 text-xs font-bold" htmlFor="tour-best-travel-time">
              <span>بهترین زمان سفر</span>
              <textarea aria-describedby="tour-best-travel-time-help" className={field} id="tour-best-travel-time" maxLength={300} name="bestTravelTime" onChange={(event) => setBestTravelTime(event.target.value)} placeholder="مثلاً بهترین زمان اجرای این تور فروردین تا خرداد است" rows={2} value={bestTravelTime} />
              <span className="block font-normal text-muted" id="tour-best-travel-time-help">این متن فقط برای همین تور ذخیره می‌شود. {bestTravelTime.length.toLocaleString("fa-IR")} از ۳۰۰ کاراکتر</span>
            </label>
          </fieldset>          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className={tourLegend}>امتیاز نمایش‌داده‌شده</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} defaultValue={editing?.ratingScore ?? ""} max={5} min={0} name="ratingScore" placeholder="امتیاز از ۵" step="0.1" type="number" />
              <input className={field} defaultValue={editing?.ratingCount ?? 0} min={0} name="ratingCount" placeholder="تعداد نظر" type="number" />
            </div>
          </fieldset>
          <textarea className={field} defaultValue={editing?.summary ?? ""} maxLength={300} name="summary" placeholder="خلاصه" rows={2} />
          <div className="space-y-2 rounded-xl border border-border bg-surface-muted p-3">
            <h3 className={`${tourHeaderBox} font-black`}>متادیتای اختصاصی صفحه تور</h3>
            <input className={field} defaultValue={editing?.metaTitle ?? ""} maxLength={70} name="metaTitle" placeholder="عنوان SEO، حداکثر ۷۰ کاراکتر" />
            <textarea className={field} defaultValue={editing?.metaDescription ?? ""} maxLength={160} name="metaDescription" placeholder="توضیحات SEO، حداکثر ۱۶۰ کاراکتر" rows={2} />
          </div>
          <RichTextEditor defaultValue={editing?.description} label="توضیحات کامل تور" name="description" />
          <textarea className={field} defaultValue={editing?.includedServices ?? ""} name="includedServices" placeholder="خدمات شامل‌شده؛ هر مورد در یک خط" rows={4} />
          <textarea className={field} defaultValue={editing?.excludedServices ?? ""} name="excludedServices" placeholder="خدمات شامل‌نشده؛ هر مورد در یک خط" rows={3} />
          <textarea className={field} defaultValue={editing?.requiredDocuments ?? ""} name="requiredDocuments" placeholder="مدارک لازم؛ هر مورد در یک خط" rows={4} />
          <RichTextEditor defaultValue={editing?.tourNotes} label="توضیحات، قوانین پرداخت و نکات مهم" name="tourNotes" rows={6} />
          <div className="grid gap-2 sm:grid-cols-2">
            <textarea className={field} defaultValue={editing?.installmentTerms ?? ""} name="installmentTerms" placeholder="شرایط اقساط؛ هر مورد در یک خط" rows={4} />
            <textarea className={field} defaultValue={editing?.refundPolicy ?? ""} name="refundPolicy" placeholder="قوانین لغو، جریمه و نحوه استرداد تور" rows={4} />
          </div>
          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className={tourLegend}>قیمت و خدمات حمل‌ونقل پکیج</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"><input defaultChecked={editing?.flightIncluded} name="flightIncluded" type="checkbox" /> بلیت رفت‌وبرگشت داخل قیمت پکیج است</label>
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"><input defaultChecked={editing?.airportTransferIncluded} name="airportTransferIncluded" type="checkbox" /> ترانسفر فرودگاهی داخل پکیج است</label>
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"><input checked={isCombinedStay} className="size-4 accent-violet-700" name="isCombinedStay" onChange={(event) => setIsCombinedStay(event.target.checked)} type="checkbox" /> {"\u0627\u06cc\u0646 \u062a\u0648\u0631 \u067e\u06a9\u06cc\u062c \u0627\u0642\u0627\u0645\u062a \u062a\u0631\u06a9\u06cc\u0628\u06cc \u062f\u0627\u0631\u062f"}</label>
            </div>
            <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:grid-cols-[1fr_12rem]">
              <label className="space-y-1 text-xs font-bold">
                <span>هزینه جداگانه پرواز هر نفر</span>
                <input className={field} defaultValue={editing?.flightPriceAmount ?? ""} min={0} name="flightPriceAmount" placeholder="خالی = نرخ پرواز هتل پایه / Excel" step="any" type="number" />
              </label>
              <CurrencySelect className={field} defaultValue={editing?.flightPriceCurrency ?? "IRT"} label="واحد پول پرواز" name="flightPriceCurrency" />
            </div>
          </fieldset>
          {isCombinedStay ? <CombinedTourPackageFields hotels={hotels} onChange={setCombinedPackages} packages={combinedPackages} /> : null}
          <StructuredTourFields
            departures={departures}
            hotels={hotels}
            destinations={destinations}
            itineraryDays={itineraryDays}
            travelLegs={travelLegs}
            onDeparturesChange={setDepartures}
            onItineraryChange={setItineraryDays}
            onTravelLegsChange={setTravelLegs}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={field} defaultValue={editing?.availabilityStatus ?? "available"} name="availabilityStatus">
              <option value="available">قابل نمایش</option><option value="unavailable">ناموجود</option><option value="archived">بایگانی</option>
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"><input defaultChecked={editing?.isFeatured} name="isFeatured" type="checkbox" /> پرفروش</label>
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 transition has-[:checked]:border-accent-strong has-[:checked]:bg-[#fff1f7]"><input className="size-4 accent-[#eb5d9f]" defaultChecked={editing?.isInstallmentAvailable} name="isInstallmentAvailable" type="checkbox" /><span>قابل خرید اقساطی</span></label>
            </div>
          </div>
          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className={tourLegend}>نمایش در صفحه تورها</legend>
            <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"><input defaultChecked={editing?.isHomeRecommended} name="isHomeRecommended" type="checkbox" /> پیشنهاد منتخب</label>
            <p className="text-xs text-muted">در سه پیشنهاد اول صفحه اصلی نمایش داده می‌شود. اگر بیش از سه تور انتخاب شود، اولویت نمایش بالاتر مقدم است.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-bold"><span>اولویت نمایش</span><input className={field} defaultValue={editing?.displayOrder ?? 0} min={0} max={9999} name="displayOrder" type="number" /><span className="block text-muted">عدد بزرگ‌تر، کارت را بالاتر نشان می‌دهد.</span></label>
              <label className="space-y-1 text-xs font-bold"><span>برچسب روی کارت</span><input className={field} defaultValue={editing?.badgeLabel ?? ""} maxLength={40} name="badgeLabel" placeholder="مثلاً فروش ویژه یا انتخاب سردبیر" /></label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2"><input defaultChecked={editing?.isDirectFlight} name="isDirectFlight" type="checkbox" /> پرواز مستقیم</label>
              <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2"><input defaultChecked={editing?.isLastMinute} name="isLastMinute" type="checkbox" /> لحظه‌آخری</label>
            </div>
          </fieldset>          <select className={field} defaultValue={editing?.status ?? "draft"} name="status">
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">بایگانی</option>
          </select>
          <InternalNoteField defaultValue={editing?.internalNote} />
          <button className="w-full rounded-xl bg-brand px-4 py-3 font-black text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "در حال ذخیره..." : copying ? "ذخیره به‌عنوان تور جدید" : "ذخیره محتوا"}</button>
          {editing ? <button className="text-sm text-brand" onClick={resetEditor} type="button">انصراف از ویرایش</button> : null}
          {message ? <p aria-live="polite" className="text-sm">{message}</p> : null}
        </form>
      }
      items={[
        ...items.map((item) => ({ id: item.id, title: item.title, pdfHref: `/admin-gateway/admin/tours/${item.id}/package.pdf`, detail: `${destinations.find((destination) => destination.id === item.destinationId)?.title ?? "بدون مقصد"} · ${item.hotelName ?? hotels.find((hotel) => hotel.id === item.hotelId)?.name ?? "بدون هتل"}`, status: item.status })),
        ...avinaTours.map(tour => ({
          id: avinaKey(tour),
          title: tour.title || tour.sourceTitle || "تور آوینا",
          detail: tour.kind === "floating-tour" ? "آوینا · شناور" : "آوینا · تاریخ‌دار",
          searchText: tour.sourceTitle ?? "",
          status: tour.hidden ? "مخفی" : "منتشرشده",
          editOnly: true,
        })),
      ]}
      onEdit={id => {
        if (typeof id === "string") {
          resetEditor();
          setAvinaEditing(id);
        } else {
          setAvinaEditing(null);
          startEdit(items.find(item => item.id === id)!);
        }
      }}
      onDelete={id => { if (typeof id === "number") void archive(id); }}
    />
  );
}

export function ServiceManager({
  initialItems,
  countries,
  initialLoadError,
}: {
  initialItems: ManagedTravelService[];
  countries: Array<{ id: number; name: string }>;
  initialLoadError?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<ManagedTravelService | null>(null);
  const [serviceType, setServiceType] = useState("flight");
  const [origin, setOrigin] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [providerCompany, setProviderCompany] = useState("");
  const [departureDate, setDepartureDate] = useState<string | null>(null);
  const [roundTrip, setRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState<string | null>(null);
  const paired = serviceType === "flight" && roundTrip;
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [imageId, setImageId] = useState<number | null>(null);
  const [galleryImageIds, setGalleryImageIds] = useState<number[]>([]);
  const [providerIconImageId, setProviderIconImageId] = useState<number | null>(null);
  const [message, setMessage] = useState(initialLoadError ?? "");
  const [busy, setBusy] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const isTransport = ["flight", "train", "bus"].includes(serviceType);
  const isVisa = serviceType === "visa";
  const outboundDuration = formatTravelDuration(departureTime, arrivalTime);
  const transportTitle = buildTransportTitle(serviceType, origin, destinationName, providerCompany);
  const providerOptions = Array.from(new Set(items.filter((item) => item.serviceType === serviceType).map((item) => item.providerCompany).filter((value): value is string => Boolean(value))));
  const airportCodeOptions = Array.from(new Set(items.flatMap((item) => [item.originAirportCode, item.destinationAirportCode]).filter((value): value is string => Boolean(value))));

  useEffect(() => {
    let active = true;
    adminClientFetch(`/services`, { credentials: "include" })
      .then(async (response) => { if (response.ok) return response.json(); throw new Error(`Admin services request failed (${response.status}).`); })
      .then((latest: ManagedTravelService[]) => {
        if (active) setItems(latest);
      })
      .catch(() => {
        if (active) {
          setMessage("دریافت فهرست خدمات ناموفق بود. اتصال Backend را بررسی کنید.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paired && (!returnDate || !departureDate || returnDate < departureDate)) {
      setMessage("تاریخ برگشت باید برابر یا بعد از تاریخ رفت باشد.");
      return;
    }
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) || "").trim() || null;
    const airportCode = (name: string) => optional(name)?.toUpperCase() ?? null;
    const price = optional("basePrice");
    const payload = {
      title: isTransport ? transportTitle : form.get("title"),
      slug: editing ? slugOnTitleEdit(isTransport ? transportTitle : form.get("title"), editing.title, 180) : form.get("slug"),
      serviceType,
      serviceCategory: optional("serviceCategory"),
      summary: form.get("summary"),
      description: form.get("description"),
      country: optional("country"),
      origin: isTransport ? origin.trim() || null : optional("origin"),
      destinationName: isTransport ? destinationName.trim() || null : optional("destinationName"),
      originAirport: serviceType === "flight" ? optional("originAirport") : null,
      originAirportCode: serviceType === "flight" ? airportCode("originAirportCode") : null,
      destinationAirport: serviceType === "flight" ? optional("destinationAirport") : null,
      destinationAirportCode: serviceType === "flight" ? airportCode("destinationAirportCode") : null,
      originTerminal: isTransport ? optional("originTerminal") : null,
      destinationTerminal: isTransport ? optional("destinationTerminal") : null,
      transportClass: isTransport ? optional("transportClass") : null,
      providerIconImageId: isTransport ? providerIconImageId : null,
      departureDate,
      returnDate: paired ? returnDate : null,
      departureTime: optional("departureTime"),
      arrivalTime: isTransport ? optional("arrivalTime") : null,
      returnTime: paired ? optional("returnTime") : null,
      returnArrivalTime: paired ? optional("returnArrivalTime") : null,
      baggageAllowance: optional("baggageAllowance"),
      providerCompany: isTransport ? providerCompany.trim() || null : optional("providerCompany"),
      refundPolicy: optional("refundPolicy"),
      flightClass: serviceType === "flight" ? optional("flightClass") : null,
      flightNumber: serviceType === "flight" ? optional("flightNumber") : null,
      returnFlightNumber: paired ? optional("returnFlightNumber") : null,
      stopsCount: serviceType === "flight" && optional("stopsCount") !== null ? Number(form.get("stopsCount")) : null,
      availableSeats: isTransport && optional("availableSeats") !== null ? Number(form.get("availableSeats")) : null,
      tripType: paired ? "round_trip" : isTransport ? "one_way" : null,
      compartmentType: serviceType === "train" ? optional("compartmentType") : null,
      passengerCategory: serviceType === "train" ? optional("passengerCategory") : null,
      carTransport: serviceType === "train" && form.get("carTransport") === "true",
      flightScope: serviceType === "flight" ? optional("flightScope") : null,
      aircraftModel: serviceType === "flight" ? optional("aircraftModel") : null,
      basePrice: price ? Number(price) : null,
      currency: String(form.get("currency") || "IRT").toUpperCase(),
      visaRequirements: optional("visaRequirements"),
      visaDocumentRequirements: serviceType === "visa"
        ? String(form.get("visaDocumentRequirements") || "")
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      visaType: serviceType === "visa" ? optional("visaType") : null,
        internalNote: optional("internalNote"),
      visaProcessingTime: optional("visaProcessingTime"),
      visaFormUrl: serviceType === "visa" ? optional("visaFormUrl") : null,
      imageId,
      galleryImageIds,
      displayOrder: Number(form.get("displayOrder") || 0),
      isFeatured: form.get("isFeatured") === "on",
      status: form.get("status"),
      metaTitle: optional("metaTitle"),
      metaDescription: optional("metaDescription"),
    };
    const response = await adminClientFetch(
      `/services${editing ? `/${editing.id}` : ""}`,
      {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!response.ok) return setMessage(await adminErrorText(response, "خدمت"));
    const saved = (await response.json()) as ManagedTravelService;
    setItems((current) => editing
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current]);
    resetEditor();
    event.currentTarget.reset();
    setMessage(
      saved.status === "published"
        ? "خدمت سفر ذخیره و منتشر شد و اکنون در سایت نمایش داده می‌شود."
        : "پیش‌نویس خدمت ذخیره شد؛ برای نمایش در سایت آن را منتشر کنید.",
    );
  }

  function resetEditor() {
    setRoundTrip(false);
    setReturnDate(null);
    setEditing(null);
    setServiceType("flight");
    setOrigin("");
    setDestinationName("");
    setProviderCompany("");
    setDepartureDate(null);
    setDepartureTime("");
    setArrivalTime("");
    setImageId(null);
    setGalleryImageIds([]);
    setProviderIconImageId(null);
    setEditorVersion((current) => current + 1);
    setMessage("");
  }

  function startEdit(item: ManagedTravelService) {
    setRoundTrip(item.tripType === "round_trip");
    setReturnDate(item.returnDate ?? null);
    setEditing(item);
    setServiceType(item.serviceType);
    setOrigin(item.origin ?? "");
    setDestinationName(item.destinationName ?? "");
    setProviderCompany(item.providerCompany ?? "");
    setDepartureDate(item.departureDate);
    setDepartureTime(item.departureTime?.slice(0, 5) ?? "");
    setArrivalTime(item.arrivalTime?.slice(0, 5) ?? "");
    setImageId(item.imageId);
    setGalleryImageIds(item.galleryImageIds);
    setProviderIconImageId(item.providerIconImageId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function archive(id: number) {
    if (!window.confirm("این خدمت برای همیشه از دیتابیس حذف شود؟ این عمل قابل بازگردانی نیست.")) return;
    const response = await adminClientFetch(`/services/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("خدمت از سایت حذف شد.");
    } else {
      setMessage(await adminErrorText(response, "حذف خدمت ناموفق بود."));
    }
  }

  return <ManagerLayout form={<form data-admin-save-form className="space-y-3 rounded-2xl border border-border bg-surface p-5" id="admin-service-form" key={`${editing?.id ?? "new"}-${editorVersion}`} onSubmit={save}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-black">{editing ? "ویرایش محتوا" : isTransport ? `افزودن بلیت ${transportLabels[serviceType]}` : "خدمت سفر جدید"}</h2>
      <CreateItemButton formId="admin-service-form" label="خدمت سفر" onCreate={resetEditor} />
    </div>
    <p className="rounded-xl bg-accent/35 p-3 text-sm leading-7 text-brand">
      محتوای جدید به‌صورت پیش‌نویس ذخیره می‌شود. پس از تکمیل اطلاعات، وضعیت را روی «منتشرشده» قرار دهید تا در سایت نمایش داده شود.
    </p>
    {isTransport ? <label className="grid gap-1 text-sm font-bold"><span>عنوان خودکار بلیت</span><input className={`${field} bg-surface-muted font-black text-brand`} name="title" readOnly value={transportTitle} /></label> : <input className={field} defaultValue={editing?.title} name="title" placeholder="عنوان" required />}
    {!editing ? <AutoSlugInput className={field} sourceValue={isTransport ? transportTitle : undefined} maxLength={180} /> : null}
    <select className={field} name="serviceType" onChange={(event) => setServiceType(event.target.value)} required value={serviceType}>
      <option value="flight">هواپیما</option><option value="train">قطار</option>
      <option value="bus">اتوبوس</option><option value="hotel">هتل</option>
      <option value="visa">ویزا</option><option value="other">سایر</option>
    </select>
    {(isTransport || isVisa) ? <section className="space-y-3 rounded-2xl bg-background p-4">
      <h3 className="font-black">{isVisa ? "اطلاعات ویزا" : serviceType === "flight" ? "تعریف بلیط پرواز" : "اطلاعات مسیر یک‌طرفه"}</h3>
      {serviceType === "flight" && <fieldset className="flex flex-wrap gap-4"><legend>نوع بلیت</legend>
        <label><input type="radio" name="flightDirection" checked={!roundTrip} onChange={() => setRoundTrip(false)} /> یک‌طرفه</label>
        <label><input type="radio" name="flightDirection" checked={roundTrip} onChange={() => setRoundTrip(true)} /> رفت‌وبرگشت</label>
      </fieldset>}
      {paired && <fieldset className="grid gap-3 sm:grid-cols-2"><legend>مشخصات پرواز برگشت</legend>
        <label>تاریخ برگشت<JalaliDateInput ariaLabel="تاریخ برگشت" className={field} onChange={setReturnDate} value={returnDate} /></label>
        <label>شماره پرواز برگشت<input required className={field} name="returnFlightNumber" defaultValue={editing?.returnFlightNumber ?? ""} /></label>
        <label>ساعت حرکت برگشت<input required className={field} type="time" name="returnTime" defaultValue={editing?.returnTime?.slice(0,5) ?? ""} /></label>
        <label>ساعت رسیدن برگشت<input required className={field} type="time" name="returnArrivalTime" defaultValue={editing?.returnArrivalTime?.slice(0,5) ?? ""} /></label>
      </fieldset>}
      {isTransport && serviceType !== "flight" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-7 text-amber-900">هر رکورد فقط یک مسیر یک‌طرفه است. برای رفت‌وبرگشت، یک بلیت جدا با مبدأ و مقصد معکوس ثبت کنید؛ شرکت، ساعت و قیمت مسیر برگشت می‌تواند متفاوت باشد.</p> : null}
      <select className={field} defaultValue={editing?.country ?? ""} name="country" required={isVisa}>
        <option value="">انتخاب کشور</option>
        {countries.map((country) => <option key={country.id} value={country.name}>{country.name}</option>)}
      </select>
      {isTransport ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={field} name="origin" onChange={(event) => setOrigin(event.target.value)} placeholder="شهر مبدأ" required value={origin} />
          <input className={field} name="destinationName" onChange={(event) => setDestinationName(event.target.value)} placeholder="شهر مقصد" required value={destinationName} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={field} defaultValue={editing?.originTerminal ?? ""} name="originTerminal" placeholder={serviceType === "bus" ? "ترمینال مبدأ" : "ایستگاه مبدأ"} />
          <input className={field} defaultValue={editing?.destinationTerminal ?? ""} name="destinationTerminal" placeholder={serviceType === "bus" ? "ترمینال مقصد" : "ایستگاه مقصد"} />
        </div>
      </> : null}
      {serviceType === "flight" ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_8rem]">
        <input className={field} defaultValue={editing?.originAirport ?? ""} maxLength={160} name="originAirport" placeholder="فرودگاه مبدأ؛ مثلاً مهرآباد" required />
        <input aria-label="کد فرودگاه مبدأ" className={`${field} uppercase`} defaultValue={editing?.originAirportCode ?? ""} dir="ltr" maxLength={3} minLength={3} list="airport-code-options" name="originAirportCode" pattern="[A-Za-z]{3}" placeholder="THR" title="کد سه‌حرفی انگلیسی فرودگاه" />
        <input className={field} defaultValue={editing?.destinationAirport ?? ""} maxLength={160} name="destinationAirport" placeholder="فرودگاه مقصد؛ مثلاً عدنان مندرس" required />
        <input aria-label="کد فرودگاه مقصد" className={`${field} uppercase`} defaultValue={editing?.destinationAirportCode ?? ""} dir="ltr" maxLength={3} minLength={3} list="airport-code-options" name="destinationAirportCode" pattern="[A-Za-z]{3}" placeholder="ADB" title="کد سه‌حرفی انگلیسی فرودگاه" />
      </div> : null}
      {serviceType === "flight" ? <datalist id="airport-code-options">{airportCodeOptions.map((code) => <option key={code} value={code} />)}</datalist> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-bold"><span>{isVisa ? "تاریخ سفر" : "تاریخ حرکت"}</span><JalaliDateInput ariaLabel={isVisa ? "تاریخ سفر" : "تاریخ حرکت"} className={field} onChange={setDepartureDate} value={departureDate} /></label>
      </div>
      {isTransport ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-bold"><span>ساعت حرکت</span><Time24Input className={field} name="departureTime" onValueChange={setDepartureTime} value={departureTime} /></label>
          <label className="space-y-1 text-sm font-bold"><span>ساعت رسیدن</span><Time24Input className={field} name="arrivalTime" onValueChange={setArrivalTime} value={arrivalTime} /></label>
        </div>
        <div className="rounded-xl border border-brand/15 bg-surface-muted p-3">
          <p className="text-xs text-muted">مدت سفر (خودکار)</p>
          <strong className="mt-1 block text-brand">{outboundDuration ?? "پس از وارد کردن ساعت حرکت و رسیدن محاسبه می‌شود."}</strong>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold"><span>{serviceType === "flight" ? "ایرلاین" : "شرکت حمل‌ونقل"}</span><input className={field} list="provider-company-options" name="providerCompany" onChange={(event) => setProviderCompany(event.target.value)} placeholder={serviceType === "flight" ? "بدون ایرلاین؛ انتخاب یا ورود دستی" : "بدون شرکت؛ انتخاب یا ورود دستی"} value={providerCompany} /></label>
          <label className="grid gap-1 text-sm font-bold"><span>کلاس یا نوع سرویس</span><input className={field} defaultValue={editing?.transportClass ?? ""} name="transportClass" placeholder={serviceType === "bus" ? "مثلاً VIP ۲۵ نفره" : serviceType === "train" ? "مثلاً کوپه ۴ تخته" : "مثلاً اکونومی"} /></label>
        </div>
        <datalist id="provider-company-options">{providerOptions.map((provider) => <option key={provider} value={provider} />)}</datalist>
        <label className="grid gap-1 text-sm font-bold"><span>دسته‌بندی خدمت</span><select className={field} defaultValue={editing?.serviceCategory ?? ""} name="serviceCategory"><option value="">بدون دسته‌بندی</option>{(categoryOptions[serviceType] ?? []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm font-bold">
          <span>ظرفیت باقی‌مانده</span>
          <input
            aria-label="ظرفیت باقی‌مانده"
            className={field}
            defaultValue={editing?.availableSeats ?? ""}
            max={1000}
            min={0}
            name="availableSeats"
            placeholder="مثلاً ۴۲ صندلی"
            type="number"
          />
        </label>
        <div className="rounded-xl border border-border bg-surface-muted p-3">
          <p className="mb-3 text-sm font-black">آیکن یا لوگوی شرکت</p>
          <MediaUpload currentId={providerIconImageId} label={providerCompany || "لوگوی شرکت حمل‌ونقل"} onRemoved={() => setProviderIconImageId(null)} onUploaded={setProviderIconImageId} />
        </div>

        {serviceType === "flight" ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-bold"><span>محدوده پرواز</span><select className={field} defaultValue={editing?.flightScope ?? "domestic"} name="flightScope"><option value="domestic">داخلی</option><option value="international">خارجی</option></select></label>
          <label className="space-y-1 text-sm font-bold"><span>کلاس پرواز</span><select className={field} defaultValue={editing?.flightClass ?? "economy"} name="flightClass"><option value="economy">اکونومی (Economy)</option><option value="premium_economy">پریمیوم اکونومی (Premium Economy)</option><option value="business">بیزینس کلاس (Business)</option><option value="first">فرست کلاس (First Class)</option></select></label>
        </div> : null}
        {serviceType === "train" ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-bold"><span>نوع کوپه</span><select className={field} defaultValue={editing?.compartmentType ?? "regular"} name="compartmentType"><option value="regular">دربست نمی‌خواهم</option><option value="private">دربست می‌خواهم</option></select></label>
          <label className="space-y-1 text-sm font-bold"><span>نوع مسافرین</span><select className={field} defaultValue={editing?.passengerCategory ?? "all"} name="passengerCategory"><option value="all">مسافرین عادی</option><option value="women">ویژه خواهران</option><option value="men">ویژه برادران</option></select></label>
          <label className="space-y-1 text-sm font-bold"><span>حمل خودرو</span><select className={field} defaultValue={editing?.carTransport ? "true" : "false"} name="carTransport"><option value="false">نمی‌خواهم</option><option value="true">می‌خواهم</option></select></label>
        </div> : null}
        {serviceType === "flight" ? <div className="grid gap-3 sm:grid-cols-3">
          <input className={field} defaultValue={editing?.flightNumber ?? ""} name="flightNumber" placeholder="شماره پرواز" />
          <input className={field} defaultValue={editing?.aircraftModel ?? ""} maxLength={120} name="aircraftModel" placeholder="نام یا مدل هواپیما؛ مثلاً Airbus A320" />
          <input className={field} defaultValue={editing?.stopsCount ?? ""} min={0} max={12} name="stopsCount" placeholder="تعداد توقف" type="number" />
        </div> : null}
        <input className={field} defaultValue={editing?.baggageAllowance ?? ""} min={0} name="baggageAllowance" placeholder="بار مجاز (کیلوگرم)؛ مثلاً ۲۵" type="number" />
      </> : <>
        <label className="space-y-1 text-sm font-bold">
          <span>نوع ویزا</span>
          <select className={field} defaultValue={editing?.visaType ?? "tourist"} name="visaType" required>
            <option value="tourist">توریستی</option>
            <option value="business">تجاری</option>
            <option value="exhibition">نمایشگاهی</option>
            <option value="residency">اقامتی</option>
            <option value="student">دانشجویی</option>
          </select>
        </label>
        <input className={field} defaultValue={editing?.visaProcessingTime ?? ""} name="visaProcessingTime" placeholder="زمان تقریبی بررسی؛ مثلاً ۱۵ روز کاری" />
        <label className="grid gap-1 text-sm font-bold">
          <span>لینک دانلود فرم نمونه</span>
          <input className={field} defaultValue={editing?.visaFormUrl ?? ""} name="visaFormUrl" placeholder="مثلاً /visa-forms/singapore-visa-application-form.pdf" />
          <small className="font-normal leading-6 text-muted">مسیر داخلی سایت یا لینک امن HTTPS را وارد کنید. در صفحه ویزا و مرحله بارگذاری مدارک نمایش داده می‌شود.</small>
        </label>
        <label className="grid gap-1 text-sm font-bold">
          <span>مدارک موردنیاز برای بارگذاری</span>
          <textarea
            className={field}
            defaultValue={editing?.visaDocumentRequirements?.join("\n") ?? "تصویر صفحه اول پاسپورت\nعکس پرسنلی\nتصویر کارت ملی\nمدرک تمکن مالی یا گردش حساب"}
            name="visaDocumentRequirements"
            placeholder={"هر نوع مدرک را در یک خط بنویسید؛ مثال:\nتصویر پاسپورت\nعکس پرسنلی"}
            rows={6}
          />
          <small className="font-normal leading-6 text-muted">برای هر خط، یک فیلد بارگذاری مستقل در حساب کاربر ساخته می‌شود.</small>
        </label>
        <RichTextEditor defaultValue={editing?.visaRequirements ?? ""} label="اطلاعات پایه، مدارک و شرایط ویزا" name="visaRequirements" />
      </>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} defaultValue={editing?.basePrice ?? ""} min={0} name="basePrice" placeholder="هزینه پایه" type="number" />
        <CurrencySelect aria-label="واحد پول هزینه پایه" className={field} defaultValue={editing?.currency ?? "IRT"} name="currency" />
      </div>
    </section> : null}
    <label className="grid gap-1 text-sm font-bold"><span>قوانین استرداد و تغییر</span><textarea className={field} defaultValue={editing?.refundPolicy ?? ""} name="refundPolicy" placeholder="شرایط کنسلی، درصد جریمه و محدودیت تغییر تاریخ را وارد کنید." required rows={5} /></label>
    <section className="space-y-3 rounded-2xl border border-border bg-surface-muted p-4">
      <div>
        <h3 className="font-black">{isVisa ? "توضیحات ویزا" : isTransport ? "توضیحات بلیت" : "توضیحات خدمت"}</h3>
        <p className="mt-1 text-xs leading-6 text-muted">خلاصه روی کارت نمایش داده می‌شود و توضیحات کامل در صفحه جزئیات قابل مشاهده است.</p>
      </div>
      <label className="grid gap-1 text-sm font-bold">
        <span>{isVisa ? "خلاصه ویزا برای نمایش روی کارت" : isTransport ? "خلاصه بلیت برای نمایش روی کارت" : "خلاصه خدمت"}</span>
        <textarea className={field} defaultValue={editing?.summary} maxLength={300} name="summary" placeholder={isVisa ? "مثلاً شرایط و مدت بررسی ویزای ترکیه" : isTransport ? "مثلاً ساعت، مسیر یا نکته مهم این بلیت" : "خلاصه"} required rows={2} />
      </label>
      <RichTextEditor defaultValue={editing?.description} label={isVisa ? "توضیحات کامل ویزا" : isTransport ? "توضیحات کامل بلیت" : "توضیحات کامل خدمت"} name="description" required />
    </section>
    <div className="grid gap-3 sm:grid-cols-2"><input className={field} defaultValue={editing?.metaTitle ?? ""} maxLength={70} name="metaTitle" placeholder="عنوان SEO" /><input className={field} defaultValue={editing?.metaDescription ?? ""} maxLength={160} name="metaDescription" placeholder="توضیحات SEO" /></div>
    <MediaUpload currentId={imageId} label={editing?.title ?? "تصویر خدمت سفر"} onRemoved={() => setImageId(null)} onUploaded={setImageId} />
    <GalleryField imageIds={galleryImageIds} label="گالری خدمت سفر" onChange={setGalleryImageIds} />
        <InternalNoteField defaultValue={editing?.internalNote} />
    <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold"><span>ترتیب نمایش</span><input className={field} defaultValue={editing?.displayOrder ?? 0} min={0} name="displayOrder" type="number" /></label><label className="flex items-center gap-2 rounded-xl border border-border px-3"><input defaultChecked={editing?.isFeatured} name="isFeatured" type="checkbox" /> نمایش در پرفروش‌ترین‌های این خدمت</label><select className={field} defaultValue={editing?.status ?? "draft"} name="status"><option value="published">منتشرشده و قابل نمایش در سایت</option><option value="draft">پیش‌نویس و مخفی از سایت</option><option value="archived">بایگانی</option></select></div>
    <button className="w-full rounded-xl bg-brand px-4 py-3 font-black text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "در حال ذخیره..." : "ذخیره محتوا"}</button>
    {editing ? <button className="text-sm text-brand" onClick={resetEditor} type="button">انصراف از ویرایش</button> : null}{message ? <p aria-live="polite">{message}</p> : null}
  </form>} items={items.map((item) => ({ id: item.id, title: item.title, pdfHref: `/admin-gateway/admin/tours/${item.id}/package.pdf`, detail: `${item.serviceType}${item.country ? ` · ${item.country}` : ""}${["flight", "train", "bus"].includes(item.serviceType) ? ` · ${item.availableSeats === null ? "ظرفیت نامشخص" : `${item.availableSeats.toLocaleString("fa-IR")} صندلی`}` : ""}`, status: item.status }))} onEdit={(id) => startEdit(items.find((item) => item.id === id)!)} onDelete={archive} />;
}
function ManagerLayout<Id extends string | number>({ accentHeader = false, form, items, onEdit, onDelete, onCopy, listWarning }: { accentHeader?: boolean; form: React.ReactNode; items: { id: Id; title: string; detail: string; status: string; pdfHref?: string; searchText?: string; editOnly?: boolean }[]; onEdit: (id: Id) => void; onDelete: (id: Id) => void; onCopy?: (id: Id) => void; listWarning?: string }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR");
  const visibleItems = normalizedQuery
    ? items.filter((item) => `${item.title} ${item.detail} ${item.status} ${item.searchText ?? ""}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery))
    : items;

  return <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">{form}<div className="h-fit overflow-hidden rounded-2xl border border-border bg-surface xl:sticky xl:top-6"><div className={`border-b p-4 sm:p-5 ${accentHeader ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-border"}`}><h2 className="text-lg font-black sm:text-xl">محتوای ثبت‌شده</h2><label className="mt-3 grid gap-1 text-xs font-bold text-muted"><span>جست‌وجو بر اساس عنوان یا مشخصات</span><input className={field} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی محتوا" type="search" value={query} /></label>{listWarning && <p role="alert" className="mt-2 text-sm">{listWarning}</p>}</div><div className="divide-y divide-border">{visibleItems.map((item) => <article className="flex min-w-0 flex-col items-start gap-3 p-4" key={item.id}><div className="min-w-0"><strong className="break-words">{item.title}</strong><p className="break-words text-sm text-muted">{item.detail} · {item.status}</p></div><div className="flex w-full flex-wrap gap-2">{item.pdfHref ? <a className="flex-1 rounded-lg border border-brand px-3 py-2 text-center font-bold text-brand sm:flex-none" href={item.pdfHref}>PDF</a> : null}<button className="flex-1 rounded-lg bg-brand px-3 py-2 font-bold text-white hover:bg-brand-strong sm:flex-none" onClick={() => onEdit(item.id)} type="button">ویرایش</button>{onCopy && !item.editOnly ? <button className="flex-1 rounded-lg border border-brand px-3 py-2 font-bold text-brand hover:bg-brand/5 sm:flex-none" aria-label={`کپی ${item.title}`} onClick={() => onCopy(item.id)} type="button">کپی</button> : null}{!item.editOnly && <button className="flex-1 font-bold text-red-700 sm:flex-none" onClick={() => onDelete(item.id)} type="button">حذف</button>}</div></article>)}{!visibleItems.length ? <p className="p-6 text-center text-muted">{query ? "موردی مطابق جست‌وجو پیدا نشد." : "هنوز موردی ثبت نشده است."}</p> : null}</div></div></section>;
}
