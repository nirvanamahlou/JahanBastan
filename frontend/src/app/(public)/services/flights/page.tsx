import { redirect } from "next/navigation";
import { ResponsiveFilterPanel } from "@/components/content/responsive-filter-panel";
import { CountryDirectory } from "@/components/content/country-directory";
import { CountryCityFields } from "@/components/content/country-city-fields";
import catalogStyles from "@/components/content/catalog-layout.module.css";
import type { Metadata } from "next";
import Link from "next/link";

import { ErpFlightResultCard, type ErpFlightRate } from "@/components/content/erp-flight-result-card";
import { ErpRoundTripPicker } from "@/components/content/erp-round-trip-picker";
import { FlightResultCard } from "@/components/content/flight-result-card";
import { type TicketDestinationChoice } from "@/components/content/ticket-destination-picker";
import { TicketSelectionProvider } from "@/components/content/ticket-selection-provider";
import { TransportGuide } from "@/components/content/transport-guide";
import { TransportDateStrip } from "@/components/content/transport-date-strip";
import { AvailabilityNotice } from "@/components/content/availability-notice";
import { PageIntro } from "@/components/layout/page-intro";
import { JalaliDateRangeInput } from "@/components/search/jalali-date-range-input";
import { LiveFlightForm } from "@/components/search/live-flight-form";
import { FlightAirlineFilter } from "@/components/search/flight-airline-filter";
import { SearchableRouteSelect } from "@/components/search/searchable-route-select";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Container } from "@/components/ui/container";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { flightDestinationCountries } from "@/lib/flight-destination-country";
import { formatCurrency } from "@/lib/currency";
import { normalizeCountryName } from "@/lib/country-name";
import { formatPersianDate } from "@/lib/persian-date";

export const metadata: Metadata = {
  title: "خرید بلیت هواپیما",
  description: "جستجو و مقایسه پروازهای رفت‌وبرگشت بر اساس مسیر، تاریخ، ایرلاین، ساعت و قیمت.",
  alternates: { canonical: "/services/flights/" },
};

type Flight = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  imageId: number | null;
  country: string | null;
  serviceCategory: string | null;
  aircraftModel: string | null;
  origin: string | null;
  destinationName: string | null;
  originAirport: string | null;
  originAirportCode: string | null;
  destinationAirport: string | null;
  destinationAirportCode: string | null;
  departureDate: string | null;
  returnDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  returnTime: string | null;
  returnArrivalTime: string | null;
  tripType: "one_way" | "round_trip" | null;
  refundPolicy: string | null;
  baggageAllowance: string | null;
  providerCompany: string | null;
  providerIconImageId: number | null;
  flightClass: string | null;
  flightNumber: string | null;
  returnFlightNumber: string | null;
  stopsCount: number | null;
  availableSeats: number | null;
  basePrice: string | null;
  currency: string;
  isFeatured: boolean;
};

type Destination = { country: string; id: number; title: string; city: string | null; imageId: number | null };
type SearchParams = Record<string, string | string[] | undefined>;
const getValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";
const control =
  "min-h-11 w-full rounded-xl border-2 border-brand/20 bg-white/90 px-3 text-sm font-bold text-foreground outline-none transition hover:border-brand/45 hover:bg-sky-50/70 focus:border-brand focus:ring-4 focus:ring-accent";

function erpAmountInToman(amount: string, currency: string): number | null {
  const value = Number(amount);
  if (!amount.trim() || !Number.isFinite(value)) return null;
  const code = currency.trim().toUpperCase();
  if (code === "IRR") return value / 10;
  if (code === "IRT" || code === "TOMAN") return value;
  return null;
}

const tehranDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tehran" });
const tehranTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran", hourCycle: "h23" });
const rangeKinds = ["price", "departure", "arrival", "duration"] as const;
type FlightRangeKind = (typeof rangeKinds)[number];

function clockMinutes(time: string | null) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function rangeBound(value: string, whole: boolean) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed >= 0 && (!whole || Number.isSafeInteger(parsed)) ? String(parsed) : "";
}

function nativeMetrics(flight: Flight, useReturnLeg = false): Record<FlightRangeKind, number | null> {
  const departure = clockMinutes(useReturnLeg ? flight.returnTime : flight.departureTime);
  const arrival = clockMinutes(useReturnLeg ? flight.returnArrivalTime : flight.arrivalTime);
  return {
    price: erpAmountInToman(flight.basePrice ?? "", flight.currency),
    departure,
    arrival,
    duration: departure === null || arrival === null || departure === arrival ? null : (arrival - departure + 1440) % 1440,
  };
}

function erpMetrics(flight: ErpFlightRate): Record<FlightRangeKind, number | null> {
  const departure = new Date(flight.departure);
  const arrival = new Date(flight.arrival);
  const duration = Math.round((arrival.getTime() - departure.getTime()) / 60000);
  return {
    price: erpAmountInToman(flight.amount, flight.currency),
    departure: Number.isFinite(departure.getTime()) ? clockMinutes(tehranTime.format(departure)) : null,
    arrival: duration > 0 ? clockMinutes(tehranTime.format(arrival)) : null,
    duration: duration > 0 ? duration : null,
  };
}

function PublishedFlightRoutes({ flights }: { flights: ErpFlightRate[] }) {
  const routes = new Map<string, { flight: ErpFlightRate; href: string }>();
  for (const flight of flights) {
    const tripType = flight.return_leg ? "round_trip" : "one_way";
    const key = JSON.stringify([flight.origin, flight.destination, tripType]);
    const current = routes.get(key)?.flight;
    if (current && Date.parse(current.departure) <= Date.parse(flight.departure)) continue;
    const query = new URLSearchParams({
      origin: flight.origin,
      destination: flight.destination,
      tripType,
      showResults: "1",
    });
    routes.set(key, { flight, href: `/services/flights/?${query}` });
  }
  if (!routes.size) return null;

  return (
    <section aria-labelledby="published-flight-routes" className="mb-8">
      <h2 className="mb-4 text-xl font-black text-brand" id="published-flight-routes">پرترددترین مقصدها</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...routes.entries()].map(([key, { flight, href }]) => (
          <Link className="rounded-xl border border-brand/15 bg-white p-4 shadow-sm hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-brand" href={href} key={key}>
            <span className="block font-black text-brand">{flight.origin} به {flight.destination}</span>
            <span className="mt-2 block text-sm text-muted">
              {flight.return_leg ? "رفت‌وبرگشت" : "یک‌طرفه"} · نزدیک‌ترین پرواز {formatPersianDate(tehranDate.format(new Date(flight.departure)))}
            </span>
            <span className="mt-3 inline-block text-sm font-bold text-brand">مشاهدهٔ پروازها</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function FlightsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const resultsQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== undefined) resultsQuery.append(key, entry);
    }
  }
  const resultsSearch = `?${resultsQuery}`;
  if (raw.preview === "AV9030") redirect(encodeURI("/services/flights/?showResults=1&flightNumber=AV9030"));
  const country = getValue(raw.country);
  const origin = getValue(raw.origin);
  const originAirport = getValue(raw.originAirport);
  const destination = getValue(raw.destination);
  const departureFrom = getValue(raw.departureFrom);
  const requestedTripType = getValue(raw.tripType);
  const browseAllTripTypes = !requestedTripType && !getValue(raw.departureTo);
  const tripType = browseAllTripTypes || requestedTripType === "one_way" ? "one_way" : "round_trip";
  // A stale return date must never influence a one-way search.
  const departureTo = tripType === "round_trip" ? getValue(raw.departureTo) : "";
  const provider = getValue(raw.provider);
  const flightClass = getValue(raw.flightClass);
  const flightScope = getValue(raw.flightScope);
  const flightNumber = getValue(raw.flightNumber);
  const rangeParams = Object.fromEntries(rangeKinds.flatMap((kind) => ["min", "max"].map((edge) => {
    const key = edge + kind[0].toUpperCase() + kind.slice(1);
    return [key, rangeBound(getValue(raw[key]), kind !== "price")];
  })));
  const airlines = getValue(raw.airlines);
  const chosenAirlines = new Set(airlines.split("|").filter(Boolean));
  const sameAirline = getValue(raw.sameAirline) === "1";
  const fromAirport = getValue(raw.fromAirport);
  const toAirport = getValue(raw.toAirport);
  const facetParams = { ...rangeParams, airlines, sameAirline: sameAirline ? "1" : "", fromAirport, toAirport };
  const maxStops = getValue(raw.maxStops);
  const featured = getValue(raw.featured) === "true";
  const sort = getValue(raw.sort) || "recommended";
  const adultCount = Math.max(1, Number(getValue(raw.adultCount)) || 1);
  const childCount = Math.max(0, Number(getValue(raw.childCount)) || 0);
  const infantCount = Math.max(0, Number(getValue(raw.infantCount)) || 0);
  const passengerQuery = {
    adultCount: String(adultCount),
    childCount: String(childCount),
    infantCount: String(infantCount),
  };
  const shouldShowResults = Boolean(country || getValue(raw.showResults) === "1" || (destination && (origin || departureFrom || getValue(raw.passengerCount))));

  const query = new URLSearchParams({ type: "flight", pageSize: "100", sort });
  if (country) query.set("country", country);
  if (origin) query.set("origin", origin);
  if (destination) query.set("destination", destination);
  if (departureFrom) query.set("departureFrom", departureFrom);
  if (departureTo) query.set("departureTo", departureTo);
  if (!browseAllTripTypes) query.set("tripType", tripType);
  if (flightClass) query.set("flightClass", flightClass);
  if (flightScope) query.set("flightScope", flightScope);
  if (flightNumber) query.set("flightNumber", flightNumber);
  if (featured) query.set("featured", "true");

  const emptyFlightPayload = { items: [] as Flight[], total: 0 };
  const erpQuery = new URLSearchParams(browseAllTripTypes ? undefined : { tripType });
  if (origin) erpQuery.set("origin", origin);
  if (destination) erpQuery.set("destination", destination);
  if (departureFrom) erpQuery.set("departureDate", departureFrom);
  if (departureTo && tripType === "round_trip") erpQuery.set("returnDate", departureTo);
  const dateStripQuery = new URLSearchParams(query);
  dateStripQuery.delete("departureFrom");
  const erpDateStripQuery = new URLSearchParams(erpQuery);
  erpDateStripQuery.delete("departureDate");
  const hasDateStripSearch = shouldShowResults;
  const needsNearbyFlights = hasDateStripSearch && Boolean(departureFrom);
  const returnQuery = new URLSearchParams(query);
  const shouldLoadReturnTickets = shouldShowResults && !browseAllTripTypes && tripType === "round_trip" && Boolean(origin && destination);
  if (shouldLoadReturnTickets) {
    returnQuery.delete("country");
    returnQuery.set("origin", destination);
    returnQuery.set("destination", origin);
    if (departureTo) {
      returnQuery.set("departureFrom", departureTo);
      returnQuery.set("departureTo", departureTo);
    } else {
      returnQuery.delete("departureFrom");
      returnQuery.delete("departureTo");
    }
  }

  const [payload, returnPayload, providerPayload, erpFlights, erpCatalog, settings, destinationPayload, faqPayload, countries, nearbyFlights, nearbyErpFlights] = await Promise.all([
    shouldShowResults
      ? apiGet<{ items: Flight[]; total: number }>(`/services?${query}`, {
          cache: "no-store",
        }).catch(() => emptyFlightPayload)
      : Promise.resolve(emptyFlightPayload),
    shouldLoadReturnTickets
      ? apiGet<{ items: Flight[]; total: number }>(`/services?${returnQuery}`, {
          cache: "no-store",
        }).catch(() => emptyFlightPayload)
      : Promise.resolve(emptyFlightPayload),
    apiGet<{ items: Flight[]; total: number }>("/services?type=flight&pageSize=100", {
      cache: "no-store",
    }).catch(() => emptyFlightPayload),
    shouldShowResults
      ? apiGet<ErpFlightRate[]>(`/erp/flight-rates?${erpQuery}`, { cache: "no-store" })
          .then((items) => (Array.isArray(items) ? items : []))
          .catch(() => [])
      : Promise.resolve([]),
    apiGet<ErpFlightRate[]>("/erp/flight-rates?limit=100", { cache: "no-store" })
      .then((items) => (Array.isArray(items) ? items : []))
      .catch(() => []),
    apiGet<{ socialLinks: Record<string, string> }>("/settings", { cache: "no-store" })
      .catch(() => ({ socialLinks: {} })),
    apiGet<{ items: Destination[] }>("/destinations?pageSize=100", { cache: "no-store" })
      .catch(() => ({ items: [] })),
    apiGet<{ items: { id: number; question: string; answer: string }[] }>("/faqs?pageSize=6", { cache: "no-store" }).catch(() => ({ items: [] })),
    apiGet<{ items: { name: string }[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
    needsNearbyFlights
      ? apiGet<typeof emptyFlightPayload>(`/services?${dateStripQuery}`, { cache: "no-store" }).catch(() => emptyFlightPayload)
      : Promise.resolve(emptyFlightPayload),
    needsNearbyFlights
      ? apiGet<ErpFlightRate[]>(`/erp/flight-rates?${erpDateStripQuery}`, { cache: "no-store" })
          .then((items) => (Array.isArray(items) ? items : []))
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const allFlightTickets = Array.from(
    new Map(
      [
        ...payload.items.map((flight) => ({
          flight,
          direction: "outbound" as const,
          useReturnLeg: false,
        })),
        ...(!browseAllTripTypes && tripType === "round_trip"
          ? payload.items
              .filter(
                (flight) =>
                  flight.tripType === "round_trip" &&
                  Boolean(
                    flight.returnDate ||
                      flight.returnTime ||
                      flight.returnFlightNumber,
                  ),
              )
              .map((flight) => ({
                flight,
                direction: "return" as const,
                useReturnLeg: true,
              }))
          : []),
        ...(tripType === "round_trip"
          ? returnPayload.items.map((flight) => ({
              flight,
              direction: "return" as const,
              useReturnLeg: false,
            }))
          : []),
      ].map((ticket) => [
        `${ticket.flight.id}-${ticket.direction}-${ticket.useReturnLeg ? "embedded" : "direct"}`,
        ticket,
      ]),
    ).values(),
  );
  const guideSettings: Record<string, string> = settings.socialLinks;
  const countryForFlight = flightDestinationCountries(destinationPayload.items);
  const destinationCountry = normalizeCountryName(country);
  const emptyStateIconId = Number(guideSettings["transportEmptyStateImageId"]) || null;
  const destinationImages = new Map<string, number | null>();
  for (const item of destinationPayload.items) {
    for (const name of [item.title, item.city].filter((value): value is string => Boolean(value?.trim()))) {
      destinationImages.set(name.trim().toLocaleLowerCase("fa-IR"), item.imageId);
    }
  }
  const flightDestinationCounts = new Map<string, number>();
  for (const flight of providerPayload.items) {
    const name = (flight.destinationName || flight.destinationAirport || "").trim();
    if (name) flightDestinationCounts.set(name, (flightDestinationCounts.get(name) ?? 0) + 1);
  }
  for (const flight of erpCatalog) {
    if (flight.destination) flightDestinationCounts.set(
      flight.destination,
      (flightDestinationCounts.get(flight.destination) ?? 0) + 1,
    );
  }
  const flightDestinationChoices: TicketDestinationChoice[] = [...flightDestinationCounts]
    .map(([label, ticketCount]) => ({
      label,
      ticketCount,
      imageId: destinationImages.get(label.toLocaleLowerCase("fa-IR")) ?? null,
    }))
    .sort((first, second) => second.ticketCount - first.ticketCount || first.label.localeCompare(second.label, "fa"));
  const flightOriginChoices = Array.from(
    new Map(
      [
        ...providerPayload.items
          .map((flight) => flight.origin?.trim())
          .filter((city): city is string => Boolean(city))
          .map((city) => [city.toLocaleLowerCase("fa-IR"), city] as const),
        ...erpCatalog.map((flight) => [flight.origin.toLocaleLowerCase("fa-IR"), flight.origin] as const),
      ],
    ).values(),
  )
    .sort((first, second) => first.localeCompare(second, "fa"))
    .map((city) => ({ label: city, value: city }));
  const matchesRanges = (metrics: ReturnType<typeof erpMetrics>) => rangeKinds.every((kind) => {
    const suffix = kind[0].toUpperCase() + kind.slice(1);
    const low = rangeParams[`min${suffix}`];
    const high = rangeParams[`max${suffix}`];
    const value = metrics[kind];
    return (!low || (value !== null && value >= Number(low))) && (!high || (value !== null && value <= Number(high)));
  });
  const matchesAirline = (name: string) =>
    (!chosenAirlines.size || chosenAirlines.has(name)) &&
    (!provider || name.toLocaleLowerCase("fa-IR").includes(provider.toLocaleLowerCase("fa-IR")));
  const erpInCountry = (flight: ErpFlightRate) => !destinationCountry || countryForFlight(flight.destination) === destinationCountry;
  const matchesNativeFilters = (flight: Flight, useReturnLeg = false) =>
    matchesAirline(flight.providerCompany ?? "") &&
    (!maxStops || (flight.stopsCount !== null && flight.stopsCount <= Number(maxStops))) &&
    (!fromAirport || (useReturnLeg ? flight.destinationAirportCode : flight.originAirportCode) === fromAirport) &&
    (!toAirport || (useReturnLeg ? flight.originAirportCode : flight.destinationAirportCode) === toAirport) &&
    matchesRanges(nativeMetrics(flight, useReturnLeg));
  const matchesErpFilters = (flight: ErpFlightRate) => {
    const legs = [flight, ...(flight.return_leg ? [flight.return_leg] : [])];
    if (!erpInCountry(flight) || !legs.some((leg) => matchesAirline(leg.carrier))) return false;
    if (sameAirline && legs.some((leg) => leg.carrier !== flight.carrier)) return false;
    if (maxStops || (fromAirport && flight.origin_airport?.code !== fromAirport) || (toAirport && flight.destination_airport?.code !== toAirport)) return false;
    if (flightNumber && !legs.some((leg) => leg.service_number?.toLocaleLowerCase("fa-IR").includes(flightNumber.toLocaleLowerCase("fa-IR")))) return false;
    if (flightClass && !legs.some((leg) => leg.cabin_class_code === flightClass)) return false;
    return !featured && matchesRanges(erpMetrics(flight));
  };
  const flightTickets = allFlightTickets.filter(({ flight, useReturnLeg }) => matchesNativeFilters(flight, useReturnLeg));
  const scopeOf = (leg: ErpFlightRate | NonNullable<ErpFlightRate["return_leg"]>) => {
    const originCountry = countryForFlight(leg.origin);
    const arrivalCountry = countryForFlight(leg.destination);
    return leg.international ?? (originCountry && arrivalCountry ? originCountry !== arrivalCountry : null);
  };
  const visibleErpFlights = erpFlights.filter(matchesErpFilters).map(flight => ({
    ...flight, international: scopeOf(flight),
    return_leg: flight.return_leg ? { ...flight.return_leg, international: scopeOf(flight.return_leg) } : null,
  }));
  const erpScope = erpFlights.filter(erpInCountry);
  const airlineChoices = [...new Set([...erpScope.flatMap((flight) => [flight.carrier, flight.return_leg?.carrier]), ...allFlightTickets.map(({ flight }) => flight.providerCompany), ...chosenAirlines]
    .filter((name): name is string => Boolean(name && !name.includes("|"))))].sort((a, b) => a.localeCompare(b, "fa"));
  const minAirlinePrices = new Map<string, number>();
  for (const [names, price] of [
    ...erpScope.map((flight) => [[flight.carrier, flight.return_leg?.carrier], erpMetrics(flight).price] as const),
    ...allFlightTickets.map(({ flight }) => [[flight.providerCompany], nativeMetrics(flight).price] as const),
  ]) {
    if (price === null) continue;
    for (const name of names) if (name) minAirlinePrices.set(name, Math.min(price, minAirlinePrices.get(name) ?? price));
  }
  const showStops = Boolean(maxStops) || allFlightTickets.some(({ flight }) => flight.stopsCount !== null);
  const chooseErpRoundTrip = !browseAllTripTypes && tripType === "round_trip" && Boolean(origin && destination);
  const availableDates = new Set<string>();
  const dailyFares = new Map<string, Map<string, number>>();
  function recordFare(day: string, raw: string | null, currency: string) {
    availableDates.add(day);
    const toman = erpAmountInToman(raw ?? "", currency);
    const price = toman ?? Number(raw);
    if (!Number.isFinite(price) || price <= 0) return;
    const unit = toman === null ? currency : "IRT";
    const fares = dailyFares.get(day) ?? new Map<string, number>();
    fares.set(unit, Math.min(fares.get(unit) ?? price, price));
    dailyFares.set(day, fares);
  }
  if (hasDateStripSearch) {
    const today = tehranDate.format(new Date());
    for (const flight of [...payload.items, ...nearbyFlights.items]) {
      if (flight.departureDate && flight.departureDate >= today && (flight.availableSeats === null || flight.availableSeats > 0) && matchesNativeFilters(flight)) {
        recordFare(flight.departureDate, flight.basePrice, flight.currency);
      }
    }
    for (const flight of [...erpFlights, ...nearbyErpFlights].filter(matchesErpFilters)) {
      if ([flight, flight.return_leg].some(leg => leg?.remaining_capacity != null && leg.remaining_capacity < 1)) continue;
      const day = tehranDate.format(new Date(flight.departure));
      if (day >= today) recordFare(day, flight.amount, flight.currency);
    }
  }
  const hasFilters = Boolean(country || origin || originAirport || destination || departureFrom || departureTo || requestedTripType || provider || flightClass || flightScope || flightNumber || maxStops || featured || Object.values(facetParams).some(Boolean));
  const alternateTripType = tripType === "one_way" ? "round_trip" : "one_way";
  const alternateTrip = !browseAllTripTypes && origin && destination && departureFrom
    ? erpCatalog.some((flight) =>
        Boolean(flight.return_leg) === (alternateTripType === "round_trip") &&
        flight.origin === origin &&
        flight.destination === destination &&
        tehranDate.format(new Date(flight.departure)) === departureFrom,
      )
    : undefined;

  return (
    <>
      {!shouldShowResults && <PageIntro compact bannerSrc="/images/service-banners/flight-panorama-hd.webp"
        eyebrow="خدمات سفر / پرواز"
        title={country ? `پروازهای ${country}` : "پرواز بر اساس کشور"}
      />}
      <section className={shouldShowResults ? "pt-2 pb-5 sm:pt-3" : "py-8 sm:py-12"}>
        <Container className={shouldShowResults ? `${catalogStyles.catalogContainer} ${catalogStyles.flightResultsContainer}` : catalogStyles.catalogContainer}>
          <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "خدمات سفر", href: "/services/" }, { label: "پرواز" }]} />

          {shouldShowResults ? (
          <div className={`${catalogStyles.layout} ${catalogStyles.flightLayout}`}>
            <aside data-mobile-filter-panel className={`${catalogStyles.sidebar} ${catalogStyles.flightSidebar}`}>
              <ResponsiveFilterPanel title="فیلترهای پرواز">
              <LiveFlightForm className={catalogStyles.flightFilters}>
                <input name="showResults" type="hidden" value="1" />
                <input name="sort" type="hidden" value={sort} />
                <input name="flightClass" type="hidden" value={flightClass} />
                <input name="originAirport" type="hidden" value={originAirport} />
                {Object.entries(passengerQuery).map(([key, value]) => <input key={key} name={key} type="hidden" value={value} />)}
                <fieldset className={catalogStyles.flightFilterGroup}>
                <legend>مسیر و تاریخ</legend>
                <CountryCityFields key={country + destination} id="flight" countries={countries.items} country={country} city={destination} cities={flightDestinationChoices.map((item) => ({ title: item.label, value: item.label, country: providerPayload.items.find((flight) => flight.destinationName === item.label)?.country || countryForFlight(item.label) }))} />
                <SearchableRouteSelect className={control} defaultValue={origin} id="flight-origin" label="مبدأ" name="origin" options={flightOriginChoices} placeholder="شهر مبدأ" />
                <JalaliDateRangeInput key={`${departureFrom}/${departureTo}/${tripType}/${browseAllTripTypes}`} stackTripType allowAllTripTypes omitInitialTripType={browseAllTripTypes} initialDeparture={departureFrom || null} initialReturn={departureTo || null} initialTripType={tripType} />
                </fieldset>
                {flightScope ? <input name="flightScope" type="hidden" value={flightScope} /> : null}
                <FlightAirlineFilter key={`${airlines}/${sameAirline}`} options={airlineChoices.map((name) => ({ name, minPrice: minAirlinePrices.get(name) ?? null }))} selected={[...chosenAirlines]} provider={provider} sameAirline={sameAirline} showSameAirline={sameAirline || erpScope.some((flight) => flight.return_leg && flight.return_leg.carrier !== flight.carrier)} />
                {showStops ? <label>تعداد توقف
                  <select className={control} name="maxStops" defaultValue={maxStops}>
                    <option value="">همه پروازها</option>
                    <option value="0">بدون توقف</option>
                    <option value="1">حداکثر یک توقف</option>
                  </select>
                </label> : null}
                <label className={catalogStyles.flightCheckbox}><input defaultChecked={featured} name="featured" type="checkbox" value="true" /> فقط پرفروش</label>
                {hasFilters ? <Link className={catalogStyles.flightReset} href="/services/flights/">پاک کردن فیلترها</Link> : null}
              </LiveFlightForm>
              </ResponsiveFilterPanel>
            </aside>

            {shouldShowResults ? (
            <div>
              <div className="depth-box mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
                <div>
                  <h1 className="text-xl font-black text-brand">{origin && destination ? `پرواز ${origin} به ${destination}` : country ? `پروازهای ${country}` : "پروازهای موجود"}</h1>
                  <p className="mt-1 text-sm text-muted">{(flightTickets.length + visibleErpFlights.length).toLocaleString("fa-IR")} مورد پیدا شد{departureFrom ? ` · ${formatPersianDate(departureFrom)}` : ""}</p>
                </div>
                <LiveFlightForm>
                  {Object.entries({ country, origin, originAirport, destination, departureFrom, departureTo, tripType: browseAllTripTypes ? "" : tripType, provider, flightClass, flightScope, flightNumber, ...facetParams, maxStops, featured: featured ? "true" : "", ...passengerQuery, showResults: "1" }).filter(([, value]) => value).map(([key, value]) => <input key={key} name={key} type="hidden" value={value} />)}
                  <select aria-label="مرتب‌سازی پروازها" className={`${control} min-w-40`} defaultValue={sort} id="flight-results-sort" name="sort">
                    <option value="recommended">پیشنهادی</option>
                    <option value="price-asc">ارزان‌ترین</option>
                    <option value="price-desc">گران‌ترین</option>
                    <option value="departure">زودترین پرواز</option>
                  </select>
                </LiveFlightForm>
              </div>
              <TransportDateStrip prices={new Map([...dailyFares].map(([day, fares]) => [day, [...fares].map(([unit, value]) => formatCurrency(value, unit))]))} availableDates={availableDates} pathname="/services/flights/" selectedDate={departureFrom} searchParams={{ country, origin, originAirport, destination, departureTo, tripType: browseAllTripTypes ? "" : tripType, provider, flightClass, flightScope, flightNumber, ...facetParams, maxStops, sort, featured: featured ? "true" : "", ...passengerQuery, showResults: "1" }} />
              {!flightTickets.length && !visibleErpFlights.length && alternateTrip ? (
                <div className="rounded-xl border border-brand/15 bg-brand/5 p-4 text-sm">
                  <p>برای این مسیر و تاریخ، بلیت {alternateTripType === "round_trip" ? "رفت‌وبرگشت" : "یک‌طرفه"} موجود است.</p>
                  <Link className="mt-2 inline-block font-bold text-brand underline" href={`/services/flights/?${new URLSearchParams({ origin, destination, departureFrom, tripType: alternateTripType, ...passengerQuery, showResults: "1" })}`}>
                    مشاهدهٔ پروازهای {alternateTripType === "round_trip" ? "رفت‌وبرگشت" : "یک‌طرفه"}
                  </Link>
                </div>
              ) : null}
              <TicketSelectionProvider kind="flight" roundTrip={!browseAllTripTypes && tripType === "round_trip" && flightTickets.length > 0}>
                <div className="mt-5 space-y-4">
                  {chooseErpRoundTrip ? (
                    <ErpRoundTripPicker
                      key={`${origin}/${destination}/${departureFrom}/${departureTo}`}
                      flights={visibleErpFlights}
                      passengerCounts={{ adults: adultCount, children: childCount, infants: infantCount }}
                      resultsSearch={resultsSearch}
                    />
                  ) : null}
                  {[
                    ...(chooseErpRoundTrip ? [] : visibleErpFlights.map((flight) => ({
                      price: erpAmountInToman(flight.amount, flight.currency),
                      departure: Date.parse(flight.departure),
                      card: (
                    <ErpFlightResultCard
                      flight={flight}
                      key={`erp-${flight.product_ids.join("-")}`}
                      passengerCounts={{ adults: adultCount, children: childCount, infants: infantCount }}
                      resultsSearch={resultsSearch}
                    />
                      ),
                    }))),
                    ...flightTickets.map(({ flight, direction, useReturnLeg }) => ({
                      price: erpAmountInToman(flight.basePrice ?? "", flight.currency),
                      departure: Date.parse(`${(useReturnLeg ? flight.returnDate : flight.departureDate) ?? ""}T${(useReturnLeg ? flight.returnTime : flight.departureTime) || "00:00"}+03:30`),
                      card: (
                  <FlightResultCard
                    id={flight.id}
                    direction={direction}
                    useReturnLeg={useReturnLeg}
                    isFeatured={flight.isFeatured}
                    key={`${flight.id}-${direction}-${useReturnLeg ? "embedded" : "direct"}`}
                    slug={flight.slug}
                    title={flight.title}
                    summary={flight.summary}
                    serviceCategory={flight.serviceCategory}
                    aircraftModel={flight.aircraftModel}
                    origin={flight.origin}
                    destination={flight.destinationName}
                    originAirport={flight.originAirport}
                    originAirportCode={flight.originAirportCode}
                    destinationAirport={flight.destinationAirport}
                    destinationAirportCode={flight.destinationAirportCode}
                    departureTime={flight.departureTime}
                    arrivalTime={flight.arrivalTime}
                    returnTime={flight.returnTime}
                    returnArrivalTime={flight.returnArrivalTime}
                    refundPolicy={flight.refundPolicy}
                    provider={flight.providerCompany}
                    providerIconImageId={flight.providerIconImageId}
                    flightNumber={flight.flightNumber}
                    returnFlightNumber={flight.returnFlightNumber}
                    baggage={flight.baggageAllowance}
                    stopsCount={flight.stopsCount}
                    availableSeats={flight.availableSeats}
                    price={flight.basePrice}
                    currency={flight.currency}
                  />
                      ),
                    })),
                  ].sort((first, second) => {
                    if (sort === "departure") {
                      return (Number.isFinite(first.departure) ? first.departure : Infinity) -
                        (Number.isFinite(second.departure) ? second.departure : Infinity);
                    }
                    if (sort !== "price-asc" && sort !== "price-desc") return 0;
                    if (first.price === null) return second.price === null ? 0 : 1;
                    if (second.price === null) return -1;
                    return sort === "price-asc" ? first.price - second.price : second.price - first.price;
                  }).map(({ card }) => card)}
                  {!flightTickets.length && !visibleErpFlights.length ? (
                  <AvailabilityNotice departureDate={departureFrom} destination={destination} iconImageId={emptyStateIconId} label="پرواز" origin={origin} serviceType="flight" />
                  ) : null}
                </div>
              </TicketSelectionProvider>
            </div>
            ) : (
              <div className="space-y-6"><TransportGuide content={guideSettings["transportFlightGuide"]} title={"\u0631\u0627\u0647\u0646\u0645\u0627\u06cc \u062e\u0631\u06cc\u062f \u0628\u0644\u06cc\u062a \u0647\u0648\u0627\u067e\u06cc\u0645\u0627"} />{faqPayload.items.length ? <section className="rounded-3xl border border-brand/15 bg-white p-5 shadow-sm sm:p-6"><div><p className="text-xs font-black text-accent-strong">{"\u0631\u0627\u0647\u0646\u0645\u0627\u06cc \u0631\u0632\u0631\u0648"}</p><h2 className="mt-1 text-xl font-black text-brand">{"\u0633\u0648\u0627\u0644\u0627\u062a \u0645\u062a\u062f\u0627\u0648\u0644 \u067e\u0631\u0648\u0627\u0632"}</h2></div><div className="mt-4 divide-y divide-border">{faqPayload.items.map((faq, index) => <details className="group py-3" key={faq.id} open={index === 0}><summary className="cursor-pointer list-none font-black text-brand"><span className="ml-2 inline-grid size-6 place-items-center rounded-full bg-accent text-brand">+</span>{faq.question}</summary><p className="mr-8 mt-3 text-sm leading-7 text-muted">{faq.answer}</p></details>)}</div></section> : null}</div>
            )}
          </div>
          ) : (
            <div className="mt-7">
              <PublishedFlightRoutes flights={erpCatalog} />
              <CountryDirectory title="پرواز بر اساس کشور" label="پرواز" countries={countries.items} href="/services/flights/" offers={providerPayload.items.map((flight) => ({ id: flight.id, country: flight.country ?? "", imageUrl: flight.imageId ? `${PUBLIC_API_BASE_URL}/media/${flight.imageId}` : destinationImages.get(flight.destinationName?.toLocaleLowerCase("fa-IR") ?? "") ? `${PUBLIC_API_BASE_URL}/media/${destinationImages.get(flight.destinationName?.toLocaleLowerCase("fa-IR") ?? "")}` : null, amount: flight.basePrice, currency: flight.currency }))} />
              <TransportGuide content={guideSettings["transportFlightGuide"]} title="راهنمای خرید بلیت هواپیما" />
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
