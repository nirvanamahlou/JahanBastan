import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { isTourDepartureBookable, type TourDepartureAvailability } from "@/lib/tour-departure-availability";

type Page<T> = { items: T[]; total: number };
type Leg = { departure: string; remaining_capacity: number | null };
type Flight = Leg & { return_leg?: Leg | null };
type NativeFlight = { departureDate: string | null; returnDate: string | null; availableSeats: number | null };
type Tour = { slug: string; destination?: { title: string }; departureDate: string | null };
type DatedTour = {
  startsOn: string;
  remainingCapacity: number | null;
  salesStopped: boolean;
  previewOnly: boolean;
  outbound: { originName: string; destinationName: string };
  hotels: { city?: { name: string; country: { name: string } } }[];
};

const tehran = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" });

function flightDay(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(tehran.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/آ/g, "ا");
}

const hasSeats = (count: number | null) => count == null || count > 0;

export async function loadRouteCalendarDates(
  service: "tour" | "flight",
  origin: string,
  destination: string,
  destinationLabel: string,
  country: string,
  singleDestination: boolean,
  outboundDay: string | null,
  signal: AbortSignal,
) {
  async function get<T>(path: string, query?: URLSearchParams): Promise<T> {
    const response = await fetch(`${PUBLIC_API_BASE_URL}${path}${query ? `?${query}` : ""}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Calendar inventory is unavailable");
    return response.json();
  }

  async function pages<T>(path: string, query: URLSearchParams, key: "limit" | "pageSize", unpack: (value: Page<T> | T[]) => T[]) {
    const items: T[] = [];
    for (let offset = 0; !signal.aborted; offset += 100) {
      const params = new URLSearchParams(query);
      params.set(key, "100");
      params.set("offset", String(offset));
      const response = await get<Page<T> | T[]>(path, params);
      const rows = unpack(response);
      items.push(...rows);
      if (rows.length < 100 || (!Array.isArray(response) && items.length >= response.total)) break;
    }
    return items;
  }

  const list = <T,>(value: Page<T> | T[]) => Array.isArray(value) ? value : value.items;
  const query = new URLSearchParams({ origin });
  if (service === "flight") {
    query.set("destination", destination);
    const nativeQuery = new URLSearchParams(query);
    nativeQuery.set("type", "flight");
    const reverse = new URLSearchParams({ type: "flight", origin: destination, destination: origin });
    const reverseErp = new URLSearchParams({ origin: destination, destination: origin });
    const [native, erp, nativeReturns, erpReturns] = await Promise.all([
      pages<NativeFlight>("/services", nativeQuery, "pageSize", list).catch(() => []),
      pages<Flight>("/erp/flight-rates", query, "limit", list).catch(() => []),
      outboundDay ? pages<NativeFlight>("/services", reverse, "pageSize", list).catch(() => []) : [],
      outboundDay ? pages<Flight>("/erp/flight-rates", reverseErp, "limit", list).catch(() => []) : [],
    ]);
    if (outboundDay) {
      return new Set([
        ...native.filter(row => hasSeats(row.availableSeats) && row.departureDate === outboundDay).map(row => row.returnDate),
        ...nativeReturns.filter(row => hasSeats(row.availableSeats)).map(row => row.departureDate),
        ...erp.filter(row => row.return_leg && hasSeats(row.remaining_capacity) && hasSeats(row.return_leg.remaining_capacity) && flightDay(row.departure) === outboundDay).map(row => row.return_leg ? flightDay(row.return_leg.departure) : null),
        ...erpReturns.filter(row => !row.return_leg && hasSeats(row.remaining_capacity)).map(row => flightDay(row.departure)),
      ].filter((day): day is string => Boolean(day && day >= outboundDay)));
    }
    return new Set([
      ...native.filter(row => hasSeats(row.availableSeats)).map(row => row.departureDate),
      ...erp.filter(row => hasSeats(row.remaining_capacity) && hasSeats(row.return_leg?.remaining_capacity ?? null)).map(row => flightDay(row.departure)),
    ].filter((day): day is string => Boolean(day)));
  }

  if (singleDestination) query.set("destinationSlug", destination);
  if (country) query.set("country", country);
  const [tours, datedTours] = await Promise.all([
    pages<Tour>("/tours", query, "pageSize", list).catch(() => []),
    pages<DatedTour>("/erp/dated-tours", new URLSearchParams(), "limit", list).catch(() => []),
  ]);
  const dates = new Set<string>();
  for (let index = 0; index < tours.length && !signal.aborted; index += 6) {
    await Promise.all(tours.slice(index, index + 6).map(async (tour) => {
      const detail = await get<{ departures?: (TourDepartureAvailability & { departureDate: string | null })[] }>(
        `/tours/${encodeURIComponent(tour.slug)}`,
      ).catch(() => null);
      if (!detail) return;
      if (detail.departures?.length) {
        detail.departures.filter(isTourDepartureBookable).forEach(({ departureDate }) => {
          if (departureDate) dates.add(departureDate);
        });
      } else if (tour.departureDate) {
        dates.add(tour.departureDate);
      }
    }));
  }

  const city = normalize(destinationLabel || tours[0]?.destination?.title || destination);
  for (const tour of datedTours) {
    if (tour.salesStopped || tour.previewOnly || !hasSeats(tour.remainingCapacity) || normalize(tour.outbound.originName) !== normalize(origin)) continue;
    const places = tour.hotels.flatMap(hotel => hotel.city ? [hotel.city] : []);
    if (country && !places.some(place => normalize(place.country.name) === normalize(country))) continue;
    if (singleDestination && ![tour.outbound.destinationName, ...places.map(place => place.name)].some(name => normalize(name) === city)) continue;
    dates.add(tour.startsOn.slice(0, 10));
  }
  return dates;
}


