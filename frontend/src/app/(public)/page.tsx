import { homepageHeroAssets } from "@/lib/homepage-hero-assets";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { groupCountryOffers, mergeCountryCounts, type CountryOffer } from "@/lib/country-catalog";
import { HomepageServiceShowcase, type ShowcasePanel } from "@/components/search/homepage-service-showcase";
import { HomepageTourPromos } from "@/components/search/homepage-tour-promos";
import { BookIcon, ClockIcon, HotelIcon, LocationIcon, PhoneIcon } from "@/components/layout/site-icons";
import { HomepageSearchGuide, HomepageSearchProvider } from "@/components/search/homepage-search-guide";
import { HomepageHero } from "@/components/search/homepage-hero";
import type { ErpFlightRate } from "@/components/content/erp-flight-result-card";
import type { ServiceType, TransportSearchOptions } from "@/components/search/travel-search";
import { Container } from "@/components/ui/container";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { loadAllPages } from "@/lib/api/load-all-pages";
import { getPublicSettings } from "@/lib/api/public-settings";
import { formatCurrency } from "@/lib/currency";
import { normalizeCountryName } from "@/lib/country-name";
import { flightDestinationCountries } from "@/lib/flight-destination-country";
import { formatPersianDate } from "@/lib/persian-date";
import { selectHomepageTours, selectHomepageCountries } from "@/lib/homepage-tours";
import { absoluteSiteUrl } from "@/lib/site-url";
import styles from "./home-page.module.css";

const homeTitle = "آژانس جهان باستان | تور، بلیط، هتل و خدمات سفر";
const homeDescription = "آژانس مسافرتی جهان باستان؛ مقایسه و رزرو تورهای داخلی و خارجی، بلیط و هتل، خدمات ویزا و مشاوره سفر. اطلاعات و راه‌های تماس با کارشناسان جهان باستان را در سایت ببینید.";

export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    url: absoluteSiteUrl("/"),
    siteName: "جهان باستان",
    locale: "fa_IR",
    type: "website",
    images: [absoluteSiteUrl("/images/brand/jahan-bastan-logo.png")],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeDescription,
    images: [absoluteSiteUrl("/images/brand/jahan-bastan-logo.png")],
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TravelAgency",
      "@id": absoluteSiteUrl("/#organization"),
      name: "آژانس جهان باستان",
      alternateName: ["جهان باستان", "آژانس مسافرتی جهان باستان"],
      url: absoluteSiteUrl("/"),
      logo: absoluteSiteUrl("/images/brand/jahan-bastan-logo.png"),
      image: absoluteSiteUrl("/images/brand/jahan-bastan-logo.png"),
      description: homeDescription,
    },
    {
      "@type": "WebSite",
      "@id": absoluteSiteUrl("/#website"),
      url: absoluteSiteUrl("/"),
      name: "جهان باستان",
      alternateName: "آژانس جهان باستان",
      inLanguage: "fa-IR",
      publisher: { "@id": absoluteSiteUrl("/#organization") },
    },
  ],
};

type HomeDestination = { id: number; title: string; city?: string | null; slug: string; country: string; bestTravelTime: string | null; imageId: number | null };
type HomeService = { id: number; title: string; slug: string; serviceType: string; summary: string; country: string | null; imageId: number | null; basePrice: string | null; currency: string; visaType: "tourist" | "business" | "exhibition" | "residency" | "student" | null; visaProcessingTime: string | null; departureDate: string | null; origin: string | null; destinationName: string | null };
type HomeHotel = { id: number; name: string; slug: string; starRating: number; guestRating: "excellent" | "good" | "average" | null; summary: string; imageId: number | null; basePrice: string | null; currency: string; destination: { title: string; country: string } };
type HomeTour = { airlineName?: string | null; airlineLogoImageId?: number | null; id: number; slug: string; title: string; origin: string | null; departureDate: string | null; durationDays: number | null; priceAmount: string | null; currency: string | null; transportation: string | null; hotelName: string | null; summary: string | null; imageId: number | null; isHomeRecommended: boolean; isFeatured: boolean; destination: { title: string; slug: string; country: string } | null; routeDestinations?: Array<{ id: number; title: string; slug: string; country: string; city: string | null }> };
type HomeCountry = { id: number; name: string; slug: string; imageId: number | null; displayOrder?: number };
type Option = { label: string; value: string };
type FilterOptions = { destinations: Option[]; origins: Option[]; tourTypes: Option[]; transportations: Option[] };

const companyAdvantages = [
  { title: "طراحی سفر متناسب با شما", text: "مسیر، مدت و بودجه سفر براساس اولویت‌های شما تنظیم می‌شود.", icon: LocationIcon },
  { title: "راهنمایی ویزا و مدارک", text: "چک‌لیست مدارک و مراحل لازم را روشن و مرحله‌به‌مرحله دریافت می‌کنید.", icon: BookIcon },
  { title: "انتخاب دقیق اقامت", text: "هتل‌ها براساس موقعیت، کیفیت و تناسب با سبک سفر مقایسه می‌شوند.", icon: HotelIcon },
  { title: "برنامه‌ریزی منعطف", text: "تاریخ، پرواز و برنامه سفر با گزینه‌های جایگزین هماهنگ می‌شوند.", icon: ClockIcon },
] as const;

export default async function HomePage() {
  const [searchDestinationPayload, servicePayload, allHotelItems, tourPayload, filterOptions, countryPayload, settings, allHotelDirectory, erpFlights] = await Promise.all([
    apiGet<{ items: HomeDestination[] }>("/destinations?pageSize=100", { cache: "no-store" }).catch(() => ({ items: [] })),
    loadAllPages<HomeService>((offset, limit) => apiGet(`/services?pageSize=${limit}&offset=${offset}`, { cache: "no-store" })).then((items) => ({ items })).catch(() => ({ items: [] })),
    apiGet<{ items: HomeHotel[] }>("/hotels?pageSize=3", { cache: "no-store" }).then(payload => payload.items).catch((): HomeHotel[] => []),
    loadAllPages<HomeTour>((offset, limit) => apiGet(`/tours?pageSize=${limit}&offset=${offset}`, { cache: "no-store" })).then((items) => ({ items })).catch(() => ({ items: [] })),
    apiGet<FilterOptions>("/tours/filter-options", { cache: "no-store" }).catch(() => ({ destinations: [], origins: [], tourTypes: [], transportations: [] })),
    apiGet<{ items: HomeCountry[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
    getPublicSettings().catch(() => null),
    apiGet<Array<{ country: string; count: number; imageId: number | null }>>("/hotels/countries").catch(() => []),
    apiGet<ErpFlightRate[]>("/erp/flight-rates?limit=100", { cache: "no-store" })
      .then((items) => (Array.isArray(items) ? items : []))
      .catch(() => []),
  ]);
  // Only explicitly ordered countries participate in homepage merchandising.
  const homepageCountries = selectHomepageCountries(countryPayload.items);
  const visibleCountryNames = new Set(homepageCountries.map(country => normalizeCountryName(country.name)));
  const isHomepageCountry = (name: string) => visibleCountryNames.has(normalizeCountryName(name));
  tourPayload.items = tourPayload.items.filter(tour => (tour.routeDestinations?.length ? tour.routeDestinations : tour.destination ? [tour.destination] : []).some(destination => isHomepageCountry(destination.country)));
  const hotelItems = allHotelItems.filter(hotel => isHomepageCountry(hotel.destination.country));
  const hotelDirectory = allHotelDirectory.filter(country => isHomepageCountry(country.country));
  const destinationPayload = { items: searchDestinationPayload.items.slice(0, 12) };

  const heroImageId = Number(settings?.socialLinks.heroBannerImageId);
  const heroImageUrl = Number.isInteger(heroImageId) && heroImageId > 0
    ? `${PUBLIC_API_BASE_URL}/media/${heroImageId}`
    : null;
  const heroImages = Object.fromEntries(
    (["tour", "hotel", "flight", "bus", "train", "visa"] satisfies ServiceType[]).map((serviceType) => {
      const serviceName = `${serviceType[0].toUpperCase()}${serviceType.slice(1)}`;
      const serviceImageId = Number(settings?.socialLinks[`hero${serviceName}BannerImageId`]);
      return [
        serviceType,
        Number.isInteger(serviceImageId) && serviceImageId > 0
          ? `${PUBLIC_API_BASE_URL}/media/${serviceImageId}`
          : heroImageUrl ?? homepageHeroAssets[serviceType],
      ];
    }),
  ) as Record<ServiceType, string>;
  const homePromoImageId = Number(settings?.socialLinks.homePromoImageId);
  const hasHomePromoImage = Number.isInteger(homePromoImageId) && homePromoImageId > 0;
  const homePromoImageUrl = hasHomePromoImage
    ? PUBLIC_API_BASE_URL + "/media/" + homePromoImageId
    : null;
  const homePromoTitle = settings?.socialLinks.homePromoTitle?.trim() || "پیشنهاد ویژه سفر";
  const homePromoHref = settings?.socialLinks.homePromoHref?.trim() || "/tours/";
  const countryCards = [...homepageCountries];
  const knownCountries = new Set(
    countryCards.map((country) => normalizeCountryName(country.name)),
  );
  for (const destination of destinationPayload.items) {
    const countryName = normalizeCountryName(destination.country);
    if (!isHomepageCountry(countryName) || knownCountries.has(countryName)) continue;
    countryCards.push({ id: -destination.id, name: countryName, slug: countryName, imageId: destination.imageId });
    knownCountries.add(countryName);
  }
  const countryOptionsFor = (names: string[]) => {
    const options = countryPayload.items.map(({ id, name, imageId }) => ({ id, name, imageId }));
    const known = new Set(
      options.map((country) => normalizeCountryName(country.name)),
    );
    for (const name of names) {
      const normalizedName = normalizeCountryName(name);
      if (!normalizedName || known.has(normalizedName)) continue;
      options.push({ id: -options.length - 1, name: normalizedName, imageId: null });
      known.add(normalizedName);
    }
    return options;
  };
  const hotelExplorerItems = hotelItems.map((hotel) => ({
    id: hotel.id,
    country: hotel.destination.country,
    title: hotel.name,
    subtitle: `${hotel.destination.title}، ${hotel.destination.country}`,
    href: `/hotels/${hotel.slug}/`,
    kind: "hotel" as const,
    starRating: hotel.starRating,
    guestRating: hotel.guestRating,
    imageUrl: hotel.imageId ? `${PUBLIC_API_BASE_URL}/media/${hotel.imageId}` : null,
    price: hotel.basePrice ? formatCurrency(hotel.basePrice, hotel.currency) : "تماس بگیرید",
    details: [
      { label: "امتیاز", value: `${hotel.starRating.toLocaleString("fa-IR")} ستاره` },
      { label: "مقصد", value: hotel.destination.title },
      { label: "اطلاعات", value: hotel.summary || "اطلاعات اقامت" },
    ],
  }));
  const visaExplorerItems = servicePayload.items
    .filter((service) => service.serviceType === "visa" && Boolean(service.country))
    .map((service) => ({
      id: service.id,
      country: service.country!,
      title: service.title,
      subtitle: `ویزای ${service.country!}`,
      href: `/services/${service.slug}/`,
      kind: "visa" as const,
      visaType: service.visaType,
      imageUrl: service.imageId ? `${PUBLIC_API_BASE_URL}/media/${service.imageId}` : null,
      price: service.basePrice ? formatCurrency(service.basePrice, service.currency) : null,
      details: [
        { label: "زمان بررسی", value: service.visaProcessingTime || "اعلام می‌شود" },
        { label: "تاریخ سفر", value: service.departureDate ? formatPersianDate(service.departureDate) : "انتخاب تاریخ" },
        { label: "اطلاعات", value: service.summary || "جزئیات و مدارک ویزا" },
      ],
    }));

  const hotelCountries = countryOptionsFor(hotelDirectory.map((item) => item.country));
  const visaCountries = countryOptionsFor(visaExplorerItems.map((visa) => visa.country));
  const transportServiceTypes = ["flight", "bus", "train"] as const;
  const publishedTransportServices = servicePayload.items.filter((service) =>
    transportServiceTypes.some((serviceType) => serviceType === service.serviceType),
  );
  const uniqueOptions = (values: Array<string | null | undefined>) => {
    const normalizedValues = values.flatMap((value) => {
      const normalized = value?.trim();
      return normalized ? [normalized] : [];
    });
    return Array.from(new Set(normalizedValues)).map((value) => ({ label: value, value }));
  };
  const transportOptions = Object.fromEntries(
    transportServiceTypes.map((serviceType) => {
      const services = publishedTransportServices.filter(
        (service) => service.serviceType === serviceType,
      );
      const routes = services.flatMap((service) => {
        const origin = service.origin?.trim();
        const destination = service.destinationName?.trim();
        return origin && destination ? [{ origin, destination }] : [];
      });
      if (serviceType === "flight") {
        routes.push(...erpFlights.map((flight) => ({
          origin: flight.origin,
          destination: flight.destination,
        })));
      }
      const uniqueRoutes = Array.from(
        new Map(
          routes.map((route) => [`${route.origin}\u0000${route.destination}`, route]),
        ).values(),
      );

      return [
        serviceType,
        {
          origins: uniqueOptions([
            ...services.map((service) => service.origin),
            ...(serviceType === "flight" ? erpFlights.map((flight) => flight.origin) : []),
          ]),
          destinations: uniqueOptions([
            ...services.map((service) => service.destinationName),
            ...(serviceType === "flight" ? erpFlights.map((flight) => flight.destination) : []),
          ]),
          routes: uniqueRoutes,
        },
      ];
    }),
  ) as TransportSearchOptions;
  const transportationType = (value: string | null): (typeof transportServiceTypes)[number] | null => {
    const normalized = value?.trim().toLocaleLowerCase("fa-IR").replace(/[يى]/g, "ی").replace(/ك/g, "ک") ?? "";
    if (["flight", "plane", "airplane", "پرواز", "هواپیما"].includes(normalized)) return "flight";
    if (["bus", "اتوبوس"].includes(normalized)) return "bus";
    if (["train", "rail", "railway", "قطار"].includes(normalized)) return "train";
    return null;
  };
  const tourTransportOptions = Object.fromEntries(
    transportServiceTypes.map((serviceType) => {
      const tours = tourPayload.items.filter(
        (tour) => transportationType(tour.transportation) === serviceType,
      );
      const destinations = Array.from(
        new Map(
          tours.flatMap((tour) => tour.destination
            ? [[tour.destination.slug, { label: tour.destination.title, value: tour.destination.slug }] as const]
            : []),
        ).values(),
      );
      const routes = tours.flatMap((tour) => {
        const origin = tour.origin?.trim();
        return origin && tour.destination
          ? [{ origin, destination: tour.destination.slug }]
          : [];
      });

      return [
        serviceType,
        {
          origins: uniqueOptions(tours.map((tour) => tour.origin)),
          destinations,
          routes: Array.from(
            new Map(
              routes.map((route) => [`${route.origin}\u0000${route.destination}`, route]),
            ).values(),
          ),
        },
      ];
    }),
  ) as TransportSearchOptions;
  // Homepage services use the public catalogue only, so status changes in the
  // management panel are reflected without a static fallback card.
  const allRouteCountries = tourPayload.items.flatMap((tour) =>
    (tour.routeDestinations ?? []).map((destination) => destination.country),
  );
  const knownCountryNames = new Set(countryCards.map((country) => normalizeCountryName(country.name)));
  for (const name of allRouteCountries) {
    const countryName = normalizeCountryName(name);
    if (!isHomepageCountry(countryName) || knownCountryNames.has(countryName)) continue;
    countryCards.push({ id: -(countryCards.length + 1), name: countryName, slug: countryName, imageId: null });
    knownCountryNames.add(countryName);
  }
  const spotlightTours = selectHomepageTours(tourPayload.items);
  const mediaUrl = (id: number | null) => id ? `${PUBLIC_API_BASE_URL}/media/${id}` : null;
  const destinationImage = (name: string) => mediaUrl(searchDestinationPayload.items.find((item) => item.title === name)?.imageId ?? null);
  const tourCards = tourPayload.items.map((tour) => ({ id: `tour-${tour.id}`, title: tour.title, href: `/tours/${tour.slug}/`, imageUrl: mediaUrl(tour.imageId), subtitle: [tour.durationDays ? `${tour.durationDays.toLocaleString("fa-IR")} روز` : null, tour.departureDate ? formatPersianDate(tour.departureDate) : null].filter(Boolean).join(" · "), price: tour.priceAmount ? formatCurrency(tour.priceAmount, tour.currency) : "تماس بگیرید" }));
  const hotelCards = hotelExplorerItems.map((hotel) => ({ id: `hotel-${hotel.id}`, title: hotel.title, href: hotel.href, imageUrl: hotel.imageUrl, subtitle: hotel.subtitle, price: hotel.price, stars: hotel.starRating }));
  const countryTilesFor = (offers: CountryOffer[], href: string, label: string, destinationPhoto = false, onlyHomepageCountries = true) => groupCountryOffers(offers).filter(group => !onlyHomepageCountries || isHomepageCountry(group.country)).map((group) => {
    const flag = (onlyHomepageCountries ? countryCards : countryPayload.items).find((item) => normalizeCountryName(item.name) === group.country);
    const destination = searchDestinationPayload.items.find((item) => normalizeCountryName(item.country) === group.country && item.imageId);
    return { id: group.country, title: group.country, country: group.country, flagId: flag?.imageId, href: `${href}${href.includes("?") ? "&" : "?"}country=${encodeURIComponent(group.country)}`, imageUrl: destinationPhoto ? mediaUrl(destination?.imageId ?? null) ?? group.imageUrl : group.imageUrl ?? mediaUrl(destination?.imageId ?? null), subtitle: `${group.count.toLocaleString("fa-IR")} ${label}`, price: group.cheapest?.amount ? formatCurrency(group.cheapest.amount, group.cheapest.currency) : null };
  });
  const countryTiles = countryTilesFor(tourPayload.items.flatMap((tour) => (tour.routeDestinations?.length ? tour.routeDestinations : tour.destination ? [tour.destination] : []).map((destination) => ({ id: tour.id, country: destination.country, imageUrl: mediaUrl(tour.imageId), amount: tour.priceAmount, currency: tour.currency }))), "/tours/", "تور منتشرشده", true);
  const hotelCountriesTiles = mergeCountryCounts(hotelDirectory).map((item) => ({
    id: item.country, title: item.country, country: item.country,
    flagId: countryCards.find(country => normalizeCountryName(country.name) === normalizeCountryName(item.country))?.imageId,
    href: `/hotels/?country=${encodeURIComponent(item.country)}`,
    imageUrl: mediaUrl(item.imageId), subtitle: `${item.count.toLocaleString("fa-IR")} هتل`,
  }));
  const visaTiles = countryTilesFor(servicePayload.items.filter((service) => service.serviceType === "visa").map((service) => ({ id: service.id, country: service.country ?? "", imageUrl: mediaUrl(service.imageId), amount: service.basePrice, currency: service.currency })), "/services/?type=visa&showResults=1", "ویزای منتشرشده");
  const recommendedCountries = [...new Set(tourPayload.items.filter(tour => tour.isHomeRecommended).flatMap(tour => {
    const destinations = tour.routeDestinations?.length ? tour.routeDestinations : tour.destination ? [tour.destination] : [];
    return destinations.map(destination => normalizeCountryName(destination.country));
  }))];
  const countryRank = new Map(countryCards.map((country, index) => [normalizeCountryName(country.name), index]));
  const compareCountries = (a: { country?: string }, b: { country?: string }) => (countryRank.get(normalizeCountryName(a.country ?? "")) ?? Number.MAX_SAFE_INTEGER) - (countryRank.get(normalizeCountryName(b.country ?? "")) ?? Number.MAX_SAFE_INTEGER);
  countryTiles.sort(compareCountries);
  hotelCountriesTiles.sort(compareCountries);
  const showcasePanels: Record<string, ShowcasePanel> = {
    tour: { recommendedCountries, title: "تور بر اساس کشور", eyebrow: "مقصد بعدی شما", description: "", href: "/tours/", action: "مشاهده تورها", tiles: countryTiles, recommendations: spotlightTours.map((tour) => tourCards.find((card) => card.id === `tour-${tour.id}`)!).filter(Boolean) },
    visa: { title: "ویزا بر اساس کشور", eyebrow: "خدمات ویزا", description: "", href: "/services/?type=visa&showResults=1", action: "مشاهده ویزا", tiles: visaTiles, recommendations: visaExplorerItems.map((visa) => ({ id: `visa-${visa.id}`, title: visa.title, href: visa.href, imageUrl: visa.imageUrl, subtitle: visa.country, price: visa.price })) },
    hotel: { title: "هتل بر اساس کشور", eyebrow: "اقامت بعدی شما", description: "", href: "/hotels/", action: "مشاهده هتل‌ها", tiles: hotelCountriesTiles, recommendations: hotelCards },
  };
  const countryForFlight = flightDestinationCountries(searchDestinationPayload.items);
  const avinaCountryOffers: CountryOffer[] = erpFlights.map((flight) => ({
    id: `avina-${flight.product_ids.join("-")}`,
    country: countryForFlight(flight.destination),
    imageUrl: destinationImage(flight.destination),
    amount: flight.amount,
    currency: flight.currency,
  }));
  for (const type of transportServiceTypes) {
    const label = type === "flight" ? "پرواز" : type === "train" ? "قطار" : "اتوبوس";
    const services = publishedTransportServices.filter((service) => service.serviceType === type);
    const cards = services.map((service) => ({ id: `service-${service.id}`, title: service.origin && service.destinationName ? `${service.origin} ← ${service.destinationName}` : service.title, href: `/services/${service.slug}/`, imageUrl: mediaUrl(service.imageId) ?? destinationImage(service.destinationName ?? ""), subtitle: service.departureDate ? formatPersianDate(service.departureDate) : service.destinationName, price: service.basePrice ? formatCurrency(service.basePrice, service.currency) : "تماس بگیرید", international: Boolean(service.country && !["ایران", "iran"].includes(normalizeCountryName(service.country).toLowerCase())) }));
    const offers: CountryOffer[] = services.map((service) => ({ id: service.id, country: service.country ?? "", imageUrl: mediaUrl(service.imageId) ?? destinationImage(service.destinationName ?? ""), amount: service.basePrice, currency: service.currency }));
    if (type === "flight") offers.push(...avinaCountryOffers);
    const routes = countryTilesFor(offers, type === "flight" ? "/services/flights/?showResults=1" : `/services/?type=${type}&showResults=1`, label, false, type !== "flight");
    if (type === "flight") routes.sort(compareCountries);
    showcasePanels[type] = { title: `${label} بر اساس کشور`, eyebrow: type === "train" ? "سفر ریلی راحت و مطمئن" : "سفر بعدی شما", description: "", href: type === "flight" ? "/services/flights/?showResults=1" : `/services/?type=${type}&showResults=1`, action: `مشاهده ${label}ها`, tiles: routes, recommendations: cards };
  }
  return (
    <HomepageSearchProvider>
    <div className={styles.page} data-homepage-design="rev48">
      <h1 className="sr-only">{homeTitle}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd).replace(/</g, "\\u003c") }}
      />
      <HomepageHero
        heroImages={heroImages}
        hotelCountries={hotelCountries.map((country) => ({ label: country.name, value: country.name }))}
        visaCountries={visaCountries.map((country) => ({ label: country.name, value: country.name }))}
        destinations={searchDestinationPayload.items.map((destination) => ({ label: destination.title, value: destination.slug }))}
        departures={filterOptions.origins}
        transportOptions={transportOptions}
        tourTransportOptions={tourTransportOptions}
      />

      <HomepageTourPromos imageUrl={homePromoImageUrl} title={homePromoTitle} href={homePromoHref} />
      <HomepageServiceShowcase panels={showcasePanels} />
      <HomepageSearchGuide content={Object.fromEntries(Object.entries(settings?.socialLinks ?? {}).filter(([key]) => key.startsWith("searchGuide")))} />
      <section className={styles.aboutSection} aria-labelledby="home-about-title">
        <Container className={styles.about}>
          <div className={styles.aboutCopy}>
            <span className={styles.eyebrow}>چرا جهان باستان؟</span>
            <h2 id="home-about-title">همراه شما،<br />از انتخاب تا تجربهٔ سفر</h2>
            <p>در آژانس جهان باستان، تورهای داخلی و خارجی، هتل و خدمات سفر را مقایسه کنید و برای انتخاب مسیر و شرایط رزرو از کارشناسان ما راهنمایی بگیرید.</p>
            <div className={styles.aboutFeatures}>{companyAdvantages.map(({ icon: Icon, ...benefit }) => <div key={benefit.title} className={styles.aboutFeature}><Icon /><div><h3>{benefit.title}</h3><p>{benefit.text}</p></div></div>)}</div>
            <Link className={styles.aboutCta} href="/contact/">برنامه‌ریزی سفر با کارشناس ←</Link>
          </div>
          <div className={styles.aboutImage}><Image src="/images/design-rev48/about-travel-illustration.webp" alt="تصویر گرافیکی سفر با هواپیما، هتل و مقصدهای جهان" fill sizes="(max-width:900px) 90vw, 45vw" className="object-cover" /><span>سفر بعدی شما از اینجا آغاز می‌شود</span></div>
        </Container>
      </section>
      <section className={styles.consultationSection}>
        <Container className={styles.consultation}><span className={styles.consultationIcon}><PhoneIcon /></span><div><span className={styles.eyebrow}>مشاوره اختصاصی سفر</span><h2>برای انتخاب مقصد، کنار شما هستیم</h2><p>مسیر، زمان و بودجه سفرتان را بگویید تا بهترین گزینه‌ها را با هم بررسی کنیم.</p></div><div className={styles.consultationActions}><Link href="/contact/">گفت‌وگو با کارشناس ←</Link><Link href="/travel-guide/">راهنمای سفر</Link></div></Container>
      </section>
    </div>
    </HomepageSearchProvider>
  );
}
