import { TourProfileFacts } from "@/components/content/tour-profile-facts";
import { hasBookableTourPackage } from "@/lib/tour-departure-availability";
import { TourProfileHero } from "@/components/content/tour-profile-hero";
import { DatedCombinedPackages } from "@/components/content/dated-combined-packages";
import type { PublicCombinedPackage } from "@/types/combined-pricing";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { CountryFlag } from "@/components/content/country-flag";
import { StructuredTourContent } from "@/components/content/structured-tour-content";
import tourStyles from "@/components/content/structured-tour-content.module.css";
import { TourHotelFilter, type TourBookingDeparture } from "@/components/content/tour-hotel-filter";
import { TourActions } from "@/components/content/tour-actions";
import { TourDetailTabs, type TourSection } from "@/components/content/tour-detail-tabs";
import { TourDepartureCalendar } from "@/components/content/tour-departure-calendar";
import { Container } from "@/components/ui/container";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { currencyLabel } from "@/lib/currency";
import { findCountryImageId } from "@/lib/country-name";
import { formatPersianDate, isoToJalaliInput } from "@/lib/persian-date";
import { absoluteSiteUrl } from "@/lib/site-url";
import { isTourDepartureBookable } from "@/lib/tour-departure-availability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ departureId?: string | string[] }> };
type Tour = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  origin: string | null;
  durationDays: number | null;
  departureDate: string | null;
  priceAmount: string | null;
  currency: string | null;
  transportation: string | null;
  originAirport: string | null;
  originAirportCode: string | null;
  destinationAirport: string | null;
  destinationAirportCode: string | null;
  airlineName: string | null;
  airlineLogoImageId: number | null;
  flightNumber: string | null;
  departureTime: string | null;
  returnDate: string | null;
  returnOriginAirport: string | null;
  returnOriginAirportCode: string | null;
  returnDestinationAirport: string | null;
  returnDestinationAirportCode: string | null;
  returnAirlineName: string | null;
  returnAirlineLogoImageId: number | null;
  returnFlightNumber: string | null;
  returnDepartureTime: string | null;
  returnArrivalTime: string | null;
  destinationLanguage: string | null;
  destinationCurrency: string | null;
  bestTravelTime: string | null;
  ratingScore: string | null;
  ratingCount: number;
  tourType: string | null;
  imageId: number | null;
  galleryImageIds: number[];
  hotelName: string | null;
  itinerary: string | null;
  includedServices: string | null;
  excludedServices: string | null;
  requiredDocuments: string | null;
  tourNotes: string | null;
  refundPolicy: string | null;
  installmentTerms: string | null;
  imageAltText: string | null;
  flightIncluded: boolean;
  airportTransferIncluded: boolean;
  flightPriceAmount: string | null;
  flightPriceCurrency: string | null;
  stayNights: number | null;
  maxPassengers: number | null;
  travelLegs: { title: string | null; description: string | null; stageType: string | null; durationMinutes: number | null; travelClass: string | null; baggageAllowanceKg: number | null; transportation: string | null; departureDate: string | null; departureTime: string | null; arrivalTime: string | null; origin: string | null; originTerminal: string | null; destination: string | null; destinationTerminal: string | null }[];
  itineraryDays: { dayNumber: number; title: string; description: string }[];
  departures: {
    id: number;
    label: string;
    externalCode: string | null;
    priceSetCode: string | null;
    departureDate: string | null;
    returnDate: string | null;
    capacityTotal: number | null;
    capacityRemaining: number | null;
    bookingStatus: string;
    outboundAirlineName: string | null;
    outboundAirlineLogoImageId: number | null;
    outboundOriginAirport: string | null;
    outboundOriginAirportCode: string | null;
    outboundDestinationAirport: string | null;
    outboundDestinationAirportCode: string | null;
    outboundFlightNumber: string | null;
    outboundDepartureTime: string | null;
    outboundArrivalTime: string | null;
    outboundBaggageAllowanceKg: number | null;
    outboundAircraftName: string | null;
    outboundTravelClass: string | null;
    returnAirlineName: string | null;
    returnAirlineLogoImageId: number | null;
    returnOriginAirport: string | null;
    returnOriginAirportCode: string | null;
    returnDestinationAirport: string | null;
    returnDestinationAirportCode: string | null;
    returnFlightNumber: string | null;
    returnDepartureTime: string | null;
    returnArrivalTime: string | null;
    returnBaggageAllowanceKg: number | null;
    returnAircraftName: string | null;
    returnTravelClass: string | null;
    priceAmount: string | null;
    nights: number | null;
    currency: string;
    hotelPrices: {
      id: number;
      hotel: { id: number; name: string; slug: string; starRating: number; defaultRoomType: string | null; guestRating: string | null; summary: string; region: string | null; address: string | null; amenitiesDescription: string | null; imageId: number | null; galleryImageIds: number[] };
      roomType: string;
      serviceType: string;
      doublePrice: string;
      singlePrice: string;
      childWithBedPrice: string;
      packageCurrency: string;
      doubleCurrency?: string | null;
      singleCurrency?: string | null;
      childWithBedCurrency?: string | null;
      childWithoutBedPrice: string;
      childWithoutBedCurrency: string;
      infantPrice: string;
      infantCurrency: string;
      flightPricePerPerson: string;
      flightCurrency: string;
  childWithBedFlightPrice?: string | null;
  childWithBedFlightCurrency?: string;
      isAvailable: boolean;
      isBasePackage: boolean;
      capacityTotal: number | null;
      capacityRemaining: number | null;
    }[];
  }[];
  hotelPackages: { id: number; city: string | null; nights: number; boardType: string | null; doublePrice: string | null; singlePrice: string | null; childWithBedPrice: string | null; childWithoutBedPrice: string | null; currency: string; maxAdults: number | null; maxChildren: number | null; hotel: { name: string; slug: string; starRating: number; defaultRoomType: string | null; summary: string; address: string | null; amenitiesDescription: string | null; guestRating: "excellent" | "good" | "average" | null; imageId: number | null; galleryImageIds: number[] } }[];
  combinedPackages: PublicCombinedPackage[];
  hotel: { name: string; slug: string; starRating: number; summary: string; address: string | null; imageId: number | null; galleryImageIds: number[] } | null;
  destination: { title: string; slug: string; country?: string | null; bestTravelTime: string | null } | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isInstallmentAvailable: boolean;
  isDirectFlight: boolean;
  isLastMinute: boolean;
  badgeLabel: string | null;
};

type TourDeparture = Tour["departures"][number];

function persianYear(item: Tour): string | null {
  const labelYear = item.departures
    .map((departure) => departure.label.match(/(?:13|14)\d{2}/)?.[0])
    .find(Boolean);
  const departureYear = item.departures
    .map((departure) => {
      if (!departure.departureDate) return null;
      return isoToJalaliInput(departure.departureDate).match(/(?:13|14)\d{2}/)?.[0];
    })
    .find(Boolean);
  const year = labelYear ?? departureYear;
  return year ? Number(year).toLocaleString("fa-IR", { useGrouping: false }) : null;
}

function normalizeTourName(title: string): string {
  return title
    .replaceAll("انتالیا", "آنتالیا")
    .replace(/کوش\s*‌?\s*آداسی/gu, "کوش‌آداسی")
    .replace(/\s*\+\s*/gu, " و ")
    .replace(/\s*\([^)]*\)\s*/gu, " ")
    .replace(/(?:\s+(?:بهار|تابستان|پاییز|زمستان))?\s+(?:(?:13|14)\d{2}|(?:۱۳|۱۴)[۰-۹]{2})\s*$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function tourSeoCopy(item: Tour): { title: string; description: string } {
  const year = persianYear(item);
  const origin = item.origin?.trim();
  const tourName = normalizeTourName(item.title);
  const dateSuffix = year ? ` ${year}` : "";
  const originSuffix = origin ? ` از ${origin}` : "";
  const hasPublishedDeparture = item.departures.some((departure) =>
    Boolean(departure.departureDate),
  );
  const actionLabel = hasPublishedDeparture ? "قیمت و رزرو" : "راهنمای سفر و رزرو";
  const details = hasPublishedDeparture
    ? "تاریخ حرکت، مقایسه هتل‌ها، جزئیات پرواز و خدمات سفر"
    : "مسیر سفر، هتل‌ها، خدمات و شرایط رزرو";
  const installment = item.isInstallmentAvailable ? "، امکان خرید اقساطی" : "";

  return {
    title: `${tourName}${dateSuffix}${originSuffix} | ${actionLabel} | جهان باستان`,
    description: `${actionLabel} ${tourName}${dateSuffix}${originSuffix}؛ ${details}${installment} و پشتیبانی جهان باستان.`,
  };
}

function structuredPriceCurrency(currency: string | null): string | null {
  const normalized = currency?.trim().toUpperCase();
  return normalized && normalized !== "IRT" && /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : null;
}

function hasDepartureFlightDetails(departure: TourDeparture) {
  return [
    departure.outboundFlightNumber,
    departure.outboundAirlineName,
    departure.outboundAirlineLogoImageId,
    departure.outboundOriginAirport,
    departure.outboundOriginAirportCode,
    departure.outboundDestinationAirport,
    departure.outboundDestinationAirportCode,
    departure.outboundDepartureTime,
    departure.outboundArrivalTime,
    departure.returnFlightNumber,
    departure.returnAirlineName,
    departure.returnAirlineLogoImageId,
    departure.returnOriginAirport,
    departure.returnOriginAirportCode,
    departure.returnDestinationAirport,
    departure.returnDestinationAirportCode,
    departure.returnDepartureTime,
    departure.returnArrivalTime,
  ].some(Boolean);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await apiGet<Tour>(`/tours/${slug}`, { cache: "no-store" }).catch(() => null);
  if (!item) {
    return {
      title: { absolute: "جزئیات تور | جهان باستان" },
      robots: { index: false, follow: false },
    };
  }

  const seo = tourSeoCopy(item);
  const canonical = absoluteSiteUrl(`/tours/${slug}/`);
  const images = item.imageId
    ? [absoluteSiteUrl(`${PUBLIC_API_BASE_URL}/media/${item.imageId}`)]
    : undefined;

  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images,
    },
  };
}

export default async function TourPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const item = await apiGet<Tour>(`/tours/${slug}`, { cache: "no-store" }).catch(() => null);
  if (!item && ["ayt", "ayt-copy", "ika-ayt-ika", "ika-ayt-ika-copy", "ayt-copy-2", "ayt-copy-3", "ika-ayt-ika-copy-copy", "ayt-copy-2-copy"].includes(slug)) {
    const parent = await apiGet<Tour>("/tours/copy-ayt-copy-2", { cache: "no-store" }).catch(() => null);
    if (parent && ["تور آنتالیا", "آنتالیا"].includes(parent.title)) permanentRedirect("/tours/copy-ayt-copy-2/#tour-dates");
  }
  if (!item && slug === "growtech-antalya-exhibition-tour-copy") {
    const parent = await apiGet<Tour>("/tours/growtech-antalya-exhibition-tour", { cache: "no-store" }).catch(() => null);
    if (parent?.title === "تور نمایشگاه گروتک آنتالیا") permanentRedirect("/tours/growtech-antalya-exhibition-tour/#tour-dates");
  }
  if (!item) notFound();

  const { departureId } = await searchParams;
  // Keep an unavailable or invalid explicit selection distinct from a visit without a date.
  const initialDepartureId = departureId === undefined ? undefined
    : typeof departureId === "string" && /^[1-9]\d*$/.test(departureId) ? Number(departureId) : 0;
  const seo = tourSeoCopy(item);
  const images = [item.imageId, ...item.galleryImageIds].filter(
    (id): id is number => Boolean(id),
  );
  const included = lines(item.includedServices);
  const excluded = lines(item.excludedServices);
  const datedDepartures = [...item.departures]
    .filter((departure) => Boolean(departure.departureDate))
    .sort((first, second) =>
      (first.departureDate ?? "").localeCompare(second.departureDate ?? ""),
    );
  const primaryDeparture = datedDepartures[0] ?? null;
  const flightDepartures = item.departures.filter(hasDepartureFlightDetails);
  const hasDates = datedDepartures.length > 0;
  const hasStandaloneHotels = item.departures.some((departure) =>
    departure.hotelPrices.some((offer) => offer.isAvailable !== false),
  );
  const hasCombinedHotels = Boolean(item.combinedPackages?.length);
  const hasHotels = hasStandaloneHotels || hasCombinedHotels;
  const hasDocuments = Boolean(
    item.requiredDocuments ||
      item.tourNotes ||
      item.refundPolicy ||
      item.installmentTerms ||
      item.travelLegs.length ||
      item.itineraryDays.length ||
      included.length ||
      excluded.length,
  );
  const tourSections: TourSection[] = [
    "overview",
    ...(hasDates || flightDepartures.length ? (["dates"] as const) : []),
    ...(hasHotels ? (["hotels"] as const) : []),
    ...(hasDocuments ? (["documents"] as const) : []),
  ];
  const [settings, faqPayload, countryPayload] = await Promise.all([
    apiGet<{ socialLinks: Record<string, string> }>("/settings", { cache: "no-store" }).catch((): { socialLinks: Record<string, string> } => ({ socialLinks: {} })),
    apiGet<{ items: { id: number; question: string; answer: string }[] }>("/faqs?pageSize=8", { cache: "no-store" }).catch(() => ({ items: [] })),
    apiGet<{ items: { name: string; imageId: number | null }[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
  ]);
  const tourCountry = item.destination?.country ?? null;
  const countryFlagImageId = findCountryImageId(countryPayload.items, tourCountry);
  const pageUrl = absoluteSiteUrl(`/tours/${item.slug}/`);
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "خانه", item: absoluteSiteUrl("/") },
    { "@type": "ListItem", position: 2, name: "تورها", item: absoluteSiteUrl("/tours/") },
    ...(item.destination
      ? [{
          "@type": "ListItem",
          position: 3,
          name: item.destination.title,
          item: absoluteSiteUrl(`/destinations/${item.destination.slug}/`),
        }]
      : []),
    {
      "@type": "ListItem",
      position: item.destination ? 4 : 3,
      name: item.title,
      item: pageUrl,
    },
  ];
  const offers = item.departures.flatMap((departure) => {
    const currency = structuredPriceCurrency(departure.currency);
    if (
      !currency ||
      !departure.priceAmount ||
      Number(departure.priceAmount) <= 0 ||
      !isTourDepartureBookable(departure)
    ) {
      return [];
    }
    return [{
      "@type": "Offer",
      name: departure.label,
      price: departure.priceAmount,
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      url: `${pageUrl}#tour-booking`,
    }];
  });
  const tourJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      },
      {
        "@type": "TouristTrip",
        "@id": `${pageUrl}#tour`,
        name: item.title,
        description: seo.description,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        inLanguage: "fa-IR",
        ...(item.imageId
          ? { image: absoluteSiteUrl(`${PUBLIC_API_BASE_URL}/media/${item.imageId}`) }
          : {}),
        ...(item.origin ? { tripOrigin: { "@type": "Place", name: item.origin } } : {}),
        ...(item.destination
          ? {
              itinerary: {
                "@type": "Place",
                name: item.destination.title,
                url: absoluteSiteUrl(`/destinations/${item.destination.slug}/`),
              },
            }
          : {}),
        ...(item.tourType ? { touristType: item.tourType } : {}),
        provider: {
          "@type": "TravelAgency",
          name: "جهان باستان",
          url: absoluteSiteUrl("/"),
        },
        ...(offers.length ? { offers } : {}),
      },
    ],
  };

  // The overview intentionally contains only tour and destination information.
  // Flight details appear beneath their selected departure date.
  const facts = [
    {
      icon: "▦",
      label: "تاریخ حرکت",
      value: primaryDeparture?.departureDate
        ? formatPersianDate(primaryDeparture.departureDate)
        : "",
      detail: null,
    },
    {
      icon: "¤",
      label: "واحد پول",
      value: currencyLabel(item.destinationCurrency ?? item.currency) || "",
      detail: null,
    },
    {
      icon: "◎",
      label: "زبان",
      value: item.destinationLanguage ?? "",
      detail: null,
    },
    {
      icon: "▦",
      label: "بهترین زمان سفر",
      value: item.bestTravelTime ?? "",
      detail: null,
    },
  ];

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(tourJsonLd).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
      <TourProfileHero title={item.title} summary={item.summary ?? "برای دریافت اطلاعات کامل با کارشناسان ما تماس بگیرید."}
        image={item.imageId ? (
          <Image
            alt={item.imageAltText?.trim() || item.title}
            className={`object-cover ${tourStyles.heroImage}`}
            fill
            priority
            sizes="100vw"
            src={`${PUBLIC_API_BASE_URL}/media/${item.imageId}`}
          />
        ) : null}
        destination={item.destination ? <><span aria-hidden="true"> ← </span><Link href={`/destinations/${item.destination.slug}/`}>{item.destination.title}</Link></> : null}
        badges={<div className="flex flex-wrap items-center gap-2">{tourCountry ? <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white"><CountryFlag country={tourCountry} imageId={countryFlagImageId} />{tourCountry}</span> : null}<p className="text-sm font-bold text-white">{item.tourType ?? "تور جهان باستان"}</p>{item.isDirectFlight ? <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white">پرواز مستقیم</span> : null}{item.isLastMinute ? <span className="rounded-full bg-accent-strong px-3 py-1 text-xs font-black text-white">لحظه‌آخری</span> : null}{item.badgeLabel ? <span className="rounded-full bg-accent-strong px-3 py-1 text-xs font-black text-white">{item.badgeLabel}</span> : null}{item.isInstallmentAvailable ? <Link className="rounded-full bg-white px-3 py-1 text-xs font-black text-brand" href="/installments/">قابل خرید اقساطی</Link> : null}</div>}
        rating={item.ratingScore ? (
                <p className="mt-4 flex items-center gap-2 text-sm">
                  <span aria-label={`امتیاز ${item.ratingScore} از ۵`} className="text-lg text-amber-300">★★★★★</span>
                  <strong>{Number(item.ratingScore).toLocaleString("fa-IR")}</strong>
                  <span className="text-white/70">از {item.ratingCount.toLocaleString("fa-IR")} نظر</span>
                </p>
              ) : null}
        actions={<TourActions showBookingAction={hasHotels} slug={item.slug} title={item.title} />} />

      <Container className={`-mt-4 relative z-10 pb-14 ${tourStyles.profileContent}`} data-scroll-reveal-skip>
        <TourProfileFacts facts={facts} />

        <TourDetailTabs sections={tourSections} />
        {hasDates || flightDepartures.length ? (
          <div className="tour-tab-panel mt-8" data-tour-section="dates">
            <TourDepartureCalendar key={initialDepartureId} initialDepartureId={initialDepartureId} departures={item.departures.map((departure) => ({
              id: departure.id,
              label: departure.label,
              departureDate: departure.departureDate,
              nights: departure.nights,
              bookingStatus: departure.bookingStatus,
              capacityRemaining: departure.capacityRemaining,
              priceAmount: departure.priceAmount,
              currency: departure.currency,
              canBook: hasBookableTourPackage(departure, item.combinedPackages),
              flightDetails: hasDepartureFlightDetails(departure) ? <TourFlightTickets departures={[departure]} item={item} /> : null,
            }))} />
          </div>
        ) : null}

        {hasHotels ? (
          <div className="tour-tab-panel mt-4" data-tour-section="hotels">
            <DatedCombinedPackages country={tourCountry} key={initialDepartureId} initialDepartureId={initialDepartureId} departures={item.departures} exchangeRates={{ usdToIrt: settings.socialLinks.exchangeRateUsdIrt, eurToIrt: settings.socialLinks.exchangeRateEurIrt }} packages={item.combinedPackages ?? []} standaloneHotels={hasStandaloneHotels} tourId={item.id} />
            {hasStandaloneHotels ? <TourHotelFilter key={initialDepartureId} initialDepartureId={initialDepartureId} country={item.destination?.country} departures={item.departures as TourBookingDeparture[]} destination={item.destination?.title} exchangeRates={{ usdToIrt: settings.socialLinks.exchangeRateUsdIrt, eurToIrt: settings.socialLinks.exchangeRateEurIrt }} faqs={faqPayload.items} isInstallmentAvailable={item.isInstallmentAvailable} packages={[]} tourId={item.id} tourSlug={item.slug} /> : null}
          </div>
        ) : null}
        {images.length > 1 ? (
          <section aria-label="گالری تصاویر تور" className="tour-tab-grid tour-tab-panel mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-tour-section="overview">
            {images.slice(1, 7).map((id, index) => (
              <div className={`relative aspect-square overflow-hidden rounded-3xl ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`} key={id}>
                <Image
                  alt={`${item.imageAltText?.trim() || item.title}، تصویر ${index + 2}`}
                  className="object-cover transition duration-500 hover:scale-105"
                  fill
                  sizes="(max-width:640px) 100vw, 33vw"
                  src={`${PUBLIC_API_BASE_URL}/media/${id}`}
                />
              </div>
            ))}
          </section>
        ) : null}

        <div className="tour-tab-layout mt-8">
          <main className="space-y-6">
            <div className="tour-tab-panel" data-tour-section="overview">
              <article className={`${tourStyles.overviewCard} ${tourStyles.compactOverview}`} id="tour-overview">
                <header className={tourStyles.overviewHeader}>
                  <span aria-hidden="true" className={tourStyles.overviewIcon}>✦</span>
                  <div><p>شروع یک تجربه تازه</p><h2>معرفی تور</h2></div>
                </header>
                <RichText className={tourStyles.overviewCopy} content={item.description || item.summary || ""} />
              </article>
            </div>
            {hasDocuments ? (
              <div className={`tour-tab-panel ${tourStyles.compactDetails}`} data-tour-section="documents" id="tour-documents">
                <StructuredTourContent item={item} showDepartures={false} showHotelPackages={false} />
              </div>
            ) : null}
            {(included.length || excluded.length) ? (
              <div className={`tour-tab-grid tour-tab-panel grid sm:grid-cols-2 ${tourStyles.serviceGrid} ${tourStyles.compactDetails}`} data-tour-section="documents">
                <section className={tourStyles.serviceCard}>
                  <header className={tourStyles.serviceHeader}>
                    <span aria-hidden="true" className={tourStyles.serviceIcon}>✓</span>
                    <div><p>همراه این پکیج</p><h2>خدمات داخل برنامه</h2></div>
                  </header>
                  <ul className={tourStyles.serviceList}>{included.map((service) => <li key={service}><span aria-hidden="true">✓</span><span>{service}</span></li>)}</ul>
                </section>
                <section className={`${tourStyles.serviceCard} ${tourStyles.serviceExcluded}`}>
                  <header className={tourStyles.serviceHeader}>
                    <span aria-hidden="true" className={tourStyles.serviceIcon}>×</span>
                    <div><p>نیازمند هماهنگی جداگانه</p><h2>خدمات خارج از برنامه</h2></div>
                  </header>
                  <ul className={tourStyles.serviceList}>{excluded.map((service) => <li key={service}><span aria-hidden="true">—</span><span>{service}</span></li>)}</ul>
                </section>
              </div>
            ) : null}
          </main>
        </div>
      </Container>
    </>
  );
}

const airportLabel = (name: string | null, code: string | null) => {
  return [name, code ? `(${code})` : null].filter(Boolean).join(" ");
};

function TourFlightTickets({
  departures,
  item,
}: {
  departures: TourDeparture[];
  item: Tour;
}) {
  const flights = departures.flatMap((departure) => {
    const hasOutbound = [
      departure.outboundFlightNumber,
      departure.outboundAirlineName,
      departure.outboundAirlineLogoImageId,
      departure.outboundOriginAirport,
      departure.outboundOriginAirportCode,
      departure.outboundDestinationAirport,
      departure.outboundDestinationAirportCode,
      departure.outboundDepartureTime,
      departure.outboundArrivalTime,
    ].some(Boolean);
    const hasReturn = [
      departure.returnFlightNumber,
      departure.returnAirlineName,
      departure.returnAirlineLogoImageId,
      departure.returnOriginAirport,
      departure.returnOriginAirportCode,
      departure.returnDestinationAirport,
      departure.returnDestinationAirportCode,
      departure.returnDepartureTime,
      departure.returnArrivalTime,
    ].some(Boolean);

    return [
      ...(hasOutbound
        ? [{
            key: `${departure.id}-outbound`,
            title: "پرواز رفت",
            departureLabel: departure.label,
            date: departure.departureDate,
            originCity: item.origin,
            destinationCity: item.destination?.title,
            originAirport: departure.outboundOriginAirport,
            originAirportCode: departure.outboundOriginAirportCode,
            destinationAirport: departure.outboundDestinationAirport,
            destinationAirportCode: departure.outboundDestinationAirportCode,
            airline: departure.outboundAirlineName,
            airlineLogoImageId: departure.outboundAirlineLogoImageId,
            number: departure.outboundFlightNumber,
            departureTime: departure.outboundDepartureTime,
            arrivalTime: departure.outboundArrivalTime,
            baggageAllowanceKg: departure.outboundBaggageAllowanceKg,
            aircraftName: departure.outboundAircraftName,
            travelClass: departure.outboundTravelClass,
          }]
        : []),
      ...(hasReturn
        ? [{
            key: `${departure.id}-return`,
            title: "پرواز برگشت",
            departureLabel: departure.label,
            date: departure.returnDate,
            originCity: item.destination?.title,
            destinationCity: item.origin,
            originAirport: departure.returnOriginAirport,
            originAirportCode: departure.returnOriginAirportCode,
            destinationAirport: departure.returnDestinationAirport,
            destinationAirportCode: departure.returnDestinationAirportCode,
            airline: departure.returnAirlineName,
            airlineLogoImageId: departure.returnAirlineLogoImageId,
            number: departure.returnFlightNumber,
            departureTime: departure.returnDepartureTime,
            arrivalTime: departure.returnArrivalTime,
            baggageAllowanceKg: departure.returnBaggageAllowanceKg,
            aircraftName: departure.returnAircraftName,
            travelClass: departure.returnTravelClass,
          }]
        : []),
    ];
  });

  return (
    <section className="grid gap-2 md:grid-cols-2" aria-label="اطلاعات پرواز رفت و برگشت">
      <h2 className="text-sm font-black text-brand md:col-span-2">پروازهای رفت و برگشت</h2>
      {flights.map((flight) => {
        const time = [flight.departureTime?.slice(0, 5), flight.arrivalTime?.slice(0, 5)]
          .filter(Boolean)
          .join(" تا ");
        return (
          <article className={tourStyles.flightTicket} dir="rtl" key={flight.key}>
            <div className={tourStyles.ticketRoute}>
              <h3 aria-label={`از ${flight.originCity || "مبدأ"} به ${flight.destinationCity || "مقصد"}`}>
                <bdi>{flight.originCity || "مبدأ"}</bdi>
                <span aria-hidden="true">←</span>
                <bdi>{flight.destinationCity || "مقصد"}</bdi>
              </h3>
              {flight.airline || flight.airlineLogoImageId ? (
                <div className={tourStyles.ticketAirline}>
                  {flight.airlineLogoImageId ? (
                    <Image alt={flight.airline ? "" : "لوگوی ایرلاین"} height={40} width={64}
                      src={`${PUBLIC_API_BASE_URL}/media/${flight.airlineLogoImageId}`} />
                  ) : null}
                  {flight.airline && <span>{flight.airline}</span>}
                </div>
              ) : null}
              <dl className={tourStyles.ticketFacts}>
              {time ? <Fact label="ساعت" value={time} /> : null}
              {flight.originAirport || flight.originAirportCode ? <Fact label="فرودگاه مبدأ" value={airportLabel(flight.originAirport, flight.originAirportCode)} /> : null}
              {flight.destinationAirport || flight.destinationAirportCode ? <Fact label="فرودگاه مقصد" value={airportLabel(flight.destinationAirport, flight.destinationAirportCode)} /> : null}
              {flight.baggageAllowanceKg != null ? <Fact label="بار مجاز" value={`${flight.baggageAllowanceKg.toLocaleString("fa-IR")} کیلوگرم`} /> : null}
              {flight.aircraftName ? <Fact label="هواپیما" value={flight.aircraftName} /> : null}
              {flight.travelClass ? <Fact label="کلاس پرواز" value={flight.travelClass} /> : null}
              </dl>
            </div>
            <div className={tourStyles.ticketStub}>
              <span className={tourStyles.ticketDirection}>{flight.title}</span>
              {flight.date ? <time dateTime={flight.date}>{formatPersianDate(flight.date)}</time> : <span>تاریخ اعلام نشده</span>}
              {flight.number && <span>شماره پرواز <bdi>{flight.number}</bdi></span>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-muted">{label}</dt><dd className="break-words font-bold text-brand">{value}</dd></div>;
}

function lines(value: string | null) {
  return value?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) ?? [];
}
