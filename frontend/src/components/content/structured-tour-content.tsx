import { isFinalLocalTourPrice } from "@/lib/tour-price-currency";
import Image from "next/image";
import { CombinedPackageCard } from "@/components/content/combined-package-card";
import type { PublicCombinedPackage } from "@/types/combined-pricing";
import type { ReactNode } from "react";

import { hotelMapSearchUrl } from "@/components/content/hotel-location-map";
import { HotelStars } from "@/components/content/hotel-stars";
import {
  BusIcon,
  BookIcon,
  CalendarIcon,
  ClipboardIcon,
  ClockIcon,
  CreditCardIcon,
  HotelIcon,
  LocationIcon,
  MapRouteIcon,
  PlaneIcon,
  ShieldIcon,
  SuitcaseIcon,
  TrainIcon,
} from "@/components/layout/site-icons";

import { RichText } from "@/components/content/rich-text";
import { Card } from "@/components/ui/card";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";
import { tourStageTypeLabel } from "@/lib/tour-stage-type";
import { formatDurationMinutes } from "@/lib/travel-duration";
import styles from "./structured-tour-content.module.css";

type Hotel = { name: string; slug: string; starRating: number; imageId: number | null; address?: string | null; region?: string | null; destination?: string | null; country?: string | null };
type DatePrice = {
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
  capacityTotal: number | null;
  capacityRemaining: number | null;
};
export type StructuredTour = {
  requiredDocuments: string | null;
  tourNotes: string | null;
  refundPolicy: string | null;
  installmentTerms: string | null;
  travelLegs: { title: string | null; description: string | null; stageType: string | null; durationMinutes: number | null; travelClass: string | null; baggageAllowanceKg: number | null; transportation: string | null; departureDate: string | null; departureTime: string | null; arrivalTime: string | null; origin: string | null; originTerminal: string | null; destination: string | null; destinationTerminal: string | null }[];
  itineraryDays: { dayNumber: number; title: string; description: string }[];
  departures: { id: number; label: string; externalCode: string | null; priceSetCode: string | null; departureDate: string | null; returnDate: string | null; capacityTotal: number | null; capacityRemaining: number | null; bookingStatus: string; outboundFlightNumber: string | null; outboundDepartureTime: string | null; outboundArrivalTime: string | null; returnFlightNumber: string | null; returnDepartureTime: string | null; returnArrivalTime: string | null; priceAmount: string | null; currency: string; hotelPrices: DatePrice[] }[];
  hotelPackages: { city: string | null; nights: number; boardType: string | null; doublePrice: string | null; singlePrice: string | null; childWithBedPrice: string | null; childWithoutBedPrice: string | null; currency: string; hotel: Hotel }[];
  combinedPackages?: PublicCombinedPackage[];
};

function formatTourBookingPrice(value: string | number | null | undefined, currency: string | null | undefined) {
  // Legacy rows used IRR for local prices; tour prices are managed and shown in toman.
  return formatCurrency(value, currency?.toUpperCase() === "IRR" ? "IRT" : currency);
}
function priceWithFlight(base: string, currency: string, flight: string, flightCurrency: string) {
  if (Number(base) <= 0) return null;
  if (Number(flight) <= 0) return <strong>{formatTourBookingPrice(base, currency)}</strong>;
  return <strong>{formatTourBookingPrice(base, currency)} <span aria-label="به علاوه" className="text-muted">+</span> {formatTourBookingPrice(flight, flightCurrency)}</strong>;
}

function DateOffer({ offer }: { offer: DatePrice }) {
  const prices = [
    ["دو تخته", offer.doublePrice, offer.doubleCurrency ?? offer.packageCurrency, offer.doubleFlightPrice ?? offer.flightPricePerPerson, offer.flightCurrency],
    ["یک تخته", offer.singlePrice, offer.singleCurrency ?? offer.packageCurrency, offer.singleFlightPrice ?? offer.flightPricePerPerson, offer.flightCurrency],
    ...(Number(offer.extraPrice) > 0 ? [["تخت اضافه", offer.extraPrice ?? "0", offer.extraCurrency ?? offer.packageCurrency, offer.flightPricePerPerson, offer.flightCurrency] as const] : []),
    ["کودک با تخت", offer.childWithBedPrice, offer.childWithBedCurrency ?? offer.packageCurrency, isFinalLocalTourPrice(offer.childWithBedCurrency ?? offer.packageCurrency) ? "0" : offer.childWithBedFlightPrice ?? "0", offer.childWithBedFlightCurrency ?? "IRT"],
    ["کودک بدون تخت", offer.childWithoutBedPrice, offer.childWithoutBedCurrency, (["IRT", "IRR", "RIAL"].includes(offer.childWithoutBedCurrency.toUpperCase()) ? "0" : offer.childWithBedFlightPrice ?? "0"), offer.childWithBedFlightCurrency ?? "IRT"],
    ["نوزاد", offer.infantPrice, offer.infantCurrency, "0", "IRT"],
  ] as const;
  return <article className="overflow-hidden rounded-2xl border border-border bg-surface">
    <div className="grid gap-4 p-4 sm:grid-cols-[7rem_1fr]">
      {offer.hotel.imageId ? <div className="relative aspect-square overflow-hidden rounded-xl"><Image alt={offer.hotel.name} className="object-cover" fill sizes="112px" src={`${PUBLIC_API_BASE_URL}/media/${offer.hotel.imageId}`} /></div> : null}
      <div><h4 className="font-black text-brand">{offer.hotel.name}</h4><HotelStars rating={offer.hotel.starRating} /><p className="mt-2 text-sm text-muted">{offer.roomType} · خدمات {offer.serviceType}</p><span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${offer.isAvailable && offer.capacityRemaining !== 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{!offer.isAvailable || offer.capacityRemaining === 0 ? "تکمیل ظرفیت" : offer.capacityRemaining === null ? "ظرفیت موجود" : `${offer.capacityRemaining.toLocaleString("fa-IR")} اتاق باقی‌مانده`}</span><a className="mt-2 block w-fit text-xs font-black text-accent-strong underline-offset-4 hover:underline" href={hotelMapSearchUrl(offer.hotel)} rel="noreferrer" target="_blank">مشاهده نقشه</a></div>
    </div>
    <div className={`grid grid-cols-2 border-t border-border ${Number(offer.extraPrice) > 0 ? "md:grid-cols-6" : "md:grid-cols-5"}`}>{prices.map(([label, base, currency, flight, flightCurrency]) => <div className="border-border p-3 text-center md:border-l last:border-l-0" key={label}><p className="text-xs text-muted">{label}</p><div className="mt-1 min-h-5 text-sm text-brand">{Number(base) > 0 ? priceWithFlight(base, currency, flight, flightCurrency) : null}</div></div>)}</div>
  </article>;
}

type InformationTone = "violet" | "amber" | "blue" | "emerald" | "rose";
type InformationIcon = "calendar" | "documents" | "notes" | "payment" | "rules";

const informationToneClasses: Record<InformationTone, string> = {
  violet: styles.infoViolet,
  amber: styles.infoAmber,
  blue: styles.infoBlue,
  emerald: styles.infoEmerald,
  rose: styles.infoRose,
};

function InformationIconView({ icon }: { icon: InformationIcon }) {
  const className = "size-6";
  if (icon === "calendar") return <CalendarIcon className={className} />;
  if (icon === "documents") return <ClipboardIcon className={className} />;
  if (icon === "payment") return <CreditCardIcon className={className} />;
  if (icon === "rules") return <ShieldIcon className={className} />;
  return <BookIcon className={className} />;
}

function InformationCard({
  children,
  eyebrow,
  icon,
  title,
  tone,
}: {
  children: ReactNode;
  eyebrow: string;
  icon: InformationIcon;
  title: string;
  tone: InformationTone;
}) {
  return (
    <section className={`${styles.infoCard} ${informationToneClasses[tone]}`}>
      <div aria-hidden="true" className={styles.infoGlow} />
      <header className={styles.infoHeader}>
        <span aria-hidden="true" className={styles.infoIcon}>
          <InformationIconView icon={icon} />
        </span>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </header>
      <div className={styles.infoBody}>{children}</div>
    </section>
  );
}


type TravelLeg = StructuredTour["travelLegs"][number];

function TravelModeIcon({ transportation }: { transportation: string | null }) {
  const value = transportation?.trim() ?? "";
  const Icon = value.includes("پرواز")
    ? PlaneIcon
    : value.includes("قطار")
      ? TrainIcon
      : value.includes("اتوبوس") || value.includes("ترانسفر")
        ? BusIcon
        : value.includes("هتل") || value.includes("اقامت")
          ? HotelIcon
          : MapRouteIcon;

  return <Icon className="size-6" />;
}

function JourneyFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factIcon}>{icon}</span>
      <span>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </span>
    </div>
  );
}

function JourneyPlace({ label, place, terminal }: { label: string; place: string | null; terminal: string | null }) {
  return (
    <div className={styles.place}>
      <span className={styles.placeIcon}><LocationIcon className="size-5" /></span>
      <div>
        <p>{label}</p>
        <strong>{place ?? ""}</strong>
        {terminal ? <span>{terminal}</span> : null}
      </div>
    </div>
  );
}

function JourneyLeg({ leg, index }: { leg: TravelLeg; index: number }) {
  const stageTitle = leg.title?.trim() || `مرحله ${(index + 1).toLocaleString("fa-IR")}`;
  const stageTypeLabel = tourStageTypeLabel(leg.stageType);
  const formattedDuration = formatDurationMinutes(leg.durationMinutes);
  const hasFacts = Boolean(stageTypeLabel || formattedDuration || leg.travelClass || leg.baggageAllowanceKg);

  return (
    <li className={styles.routeCard}>
      <div className={styles.routeHeader}>
        <div className={styles.stageIdentity}>
          <span className={styles.stageNumber}>{(index + 1).toLocaleString("fa-IR")}</span>
          {leg.transportation ? (
            <span className={styles.transportIcon}><TravelModeIcon transportation={leg.transportation} /></span>
          ) : null}
          <div>
            <p>مرحله {(index + 1).toLocaleString("fa-IR")}</p>
            <h3>{stageTitle}</h3>
          </div>
        </div>
        <div className={styles.stageBadges}>
          {leg.transportation ? <span className={styles.transportBadge}>{leg.transportation}</span> : null}
          {leg.departureDate ? (
            <time className={styles.dateBadge} dateTime={leg.departureDate}>
              <CalendarIcon className="size-4" />
              {formatPersianDate(leg.departureDate)}
            </time>
          ) : null}
        </div>
      </div>

      <div className={styles.routePath}>
        <JourneyPlace label="مبدأ" place={leg.origin} terminal={leg.originTerminal} />
        <div className={styles.pathLine} aria-hidden="true">
          <span />
          <MapRouteIcon className="size-6" />
          <span />
        </div>
        <JourneyPlace label="مقصد" place={leg.destination} terminal={leg.destinationTerminal} />
      </div>

      {hasFacts ? (
        <dl className={styles.facts}>
          {stageTypeLabel ? <JourneyFact icon={<MapRouteIcon className="size-4" />} label="نوع مرحله" value={stageTypeLabel} /> : null}
          {formattedDuration ? <JourneyFact icon={<ClockIcon className="size-4" />} label="مدت" value={formattedDuration} /> : null}
          {leg.travelClass ? <JourneyFact icon={<PlaneIcon className="size-4" />} label="کلاس سفر" value={leg.travelClass} /> : null}
          {leg.baggageAllowanceKg ? <JourneyFact icon={<SuitcaseIcon className="size-4" />} label="بار مجاز" value={`${leg.baggageAllowanceKg.toLocaleString("fa-IR")} کیلوگرم`} /> : null}
        </dl>
      ) : null}

      {leg.departureTime || leg.arrivalTime ? (
        <div className={styles.times}>
          <ClockIcon className="size-5" />
          {leg.departureTime ? <span>حرکت <strong>{leg.departureTime.slice(0, 5)}</strong></span> : null}
          {leg.departureTime && leg.arrivalTime ? <i aria-hidden="true" /> : null}
          {leg.arrivalTime ? <span>رسیدن <strong>{leg.arrivalTime.slice(0, 5)}</strong></span> : null}
        </div>
      ) : null}

      {leg.description ? <RichText className={styles.routeDescription} content={leg.description} /> : null}
    </li>
  );
}

export function StructuredTourContent({ item, showHotelPackages = true, showDepartures = true }: { item: StructuredTour; showHotelPackages?: boolean; showDepartures?: boolean }) {
  const documents = item.requiredDocuments?.split(/\r?\n/).filter(Boolean) ?? [];
  const hasDatePrices = item.departures.some((departure) => departure.hotelPrices.length);
  const combinedPackages = item.combinedPackages ?? [];
  return (
    <div className={styles.contentStack}>
      {showDepartures && item.departures.length ? (
        <Card className={styles.departuresCard}>
          <h2 className="text-xl font-black sm:text-2xl">تاریخ‌ها و قیمت پکیج‌ها</h2>
          <div className="mt-4 space-y-5">
            {item.departures.map((departure) => (
              <section className={styles.departureItem} key={departure.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{departure.label}</strong>
                    {departure.departureDate ? <time className="mt-1 block text-sm text-muted" dateTime={departure.departureDate}>{formatPersianDate(departure.departureDate)}</time> : null}
                  </div>
                  {departure.priceAmount ? <p className="font-black text-brand">شروع از {formatTourBookingPrice(departure.priceAmount, departure.currency)}</p> : null}
                </div>
                {departure.hotelPrices.length ? <div className="mt-4 space-y-4">{departure.hotelPrices.map((offer, index) => <DateOffer key={`${offer.hotel.slug}-${offer.roomType}-${offer.serviceType}-${index}`} offer={offer} />)}</div> : <p className="mt-3 text-sm text-muted">قیمت هتل‌های این تاریخ هنوز ثبت نشده است.</p>}
              </section>
            ))}
          </div>
        </Card>
      ) : null}

      {showHotelPackages && combinedPackages.length ? (
        <Card className={styles.combinedSection}>
          <div><p className="text-sm font-black text-violet-600">اقامت چند هتلی</p><h2 className="mt-1 text-xl font-black sm:text-2xl">پکیج‌های اقامت ترکیبی</h2><p className="mt-2 text-sm leading-7 text-muted">قیمت اقامت و پرواز هر ترکیب جدا نمایش داده شده است.</p></div>
          <div className="mt-5 space-y-5">{combinedPackages.map((combinedPackage, index) => <CombinedPackageCard index={index} item={combinedPackage} key={`${combinedPackage.title}-${index}`} />)}</div>
        </Card>
      ) : null}

      {item.travelLegs.length ? (
        <Card className={styles.routeSection}>
          <div className={styles.routeSectionHeader}>
            <div className={styles.routeHeadingIcon}><MapRouteIcon className="size-7" /></div>
            <div><p>برنامه جابه‌جایی</p><h2>مسیر سفر</h2></div>
            <span>{item.travelLegs.length.toLocaleString("fa-IR")} مرحله</span>
          </div>
          <ol className={styles.routeList}>
            {item.travelLegs.map((leg, index) => <JourneyLeg index={index} key={`${leg.departureDate ?? "undated"}-${leg.origin ?? "unknown"}-${index}`} leg={leg} />)}
          </ol>
        </Card>
      ) : null}

      {item.itineraryDays.length ? (
        <InformationCard eyebrow="برنامه روزبه‌روز" icon="calendar" title="برنامه سفر پیشنهادی" tone="violet">
          <div className={styles.itineraryList}>
            {item.itineraryDays.map((day, index) => (
              <details className={styles.itineraryDay} key={day.dayNumber} open={index === 0}>
                <summary>
                  <span className={styles.dayBadge}>روز {day.dayNumber.toLocaleString("fa-IR")}</span>
                  <span className={styles.dayTitle}>{day.title}</span>
                  <span aria-hidden="true" className={styles.dayArrow}>⌄</span>
                </summary>
                {day.description ? <div className={styles.itineraryDescription}><RichText content={day.description} /></div> : null}
              </details>
            ))}
          </div>
        </InformationCard>
      ) : null}

      {documents.length ? (
        <InformationCard eyebrow="پیش از حرکت آماده کنید" icon="documents" title="مدارک لازم" tone="amber">
          <ul className={styles.documentList}>
            {documents.map((document) => <li key={document}><span aria-hidden="true">✓</span><span>{document}</span></li>)}
          </ul>
        </InformationCard>
      ) : null}

      {item.tourNotes ? (
        <InformationCard eyebrow="نکات مهم سفر" icon="notes" title="توضیحات تکمیلی تور" tone="blue">
          <RichText className={styles.infoRichText} content={item.tourNotes} />
        </InformationCard>
      ) : null}

      {item.installmentTerms ? (
        <InformationCard eyebrow="پرداخت منعطف" icon="payment" title="شرایط اقساط" tone="emerald">
          <RichText className={styles.infoRichText} content={item.installmentTerms} />
        </InformationCard>
      ) : null}

      {item.refundPolicy ? (
        <InformationCard eyebrow="شفاف و قابل بررسی" icon="rules" title="قوانین لغو و استرداد" tone="rose">
          <RichText className={styles.infoRichText} content={item.refundPolicy} />
        </InformationCard>
      ) : null}

      {showHotelPackages && !hasDatePrices && item.hotelPackages.length ? (
        <Card className={styles.legacyHotelsCard}>
          <h2 className="text-xl font-black sm:text-2xl">پکیج‌های هتل قبلی</h2>
          <div className="mt-5 space-y-5">
            {item.hotelPackages.map((hotelPackage, index) => (
              <div className={styles.legacyHotelItem} key={`${hotelPackage.hotel.slug}-${index}`}>
                <div className="p-4"><h3 className="text-lg font-black">{hotelPackage.hotel.name}</h3><HotelStars rating={hotelPackage.hotel.starRating} /><p className="mt-2 text-sm text-muted">{hotelPackage.city ?? ""} · {hotelPackage.nights.toLocaleString("fa-IR")} شب {hotelPackage.boardType ? `· ${hotelPackage.boardType}` : ""}</p><a className="mt-2 inline-flex text-xs font-black text-accent-strong underline-offset-4 hover:underline" href={hotelMapSearchUrl({ name: hotelPackage.hotel.name, address: hotelPackage.hotel.address, region: hotelPackage.city })} rel="noreferrer" target="_blank">مشاهده نقشه</a></div>
                <div className="grid grid-cols-2 border-t border-violet-100 sm:grid-cols-4">{[["دو تخته", hotelPackage.doublePrice], ["یک تخته", hotelPackage.singlePrice], ["کودک با تخت", hotelPackage.childWithBedPrice], ["کودک بدون تخت", hotelPackage.childWithoutBedPrice]].map(([label, price]) => <div className="p-3 text-center" key={label}><p className="text-xs text-muted">{label}</p><strong className="mt-1 block">{price ? formatTourBookingPrice(price, hotelPackage.currency) : "—"}</strong></div>)}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
