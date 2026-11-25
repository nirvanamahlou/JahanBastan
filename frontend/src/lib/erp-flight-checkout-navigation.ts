import type { ErpFlightRate } from "@/components/content/erp-flight-result-card";
import type { PassengerCounts } from "@/lib/tour-passenger-counts";

const flightResultsPath = "/services/flights/";
const tehranDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tehran" });

export function flightCheckoutHref(
  flight: ErpFlightRate,
  counts: PassengerCounts,
  resultsSearch: string,
) {
  const query = new URLSearchParams({
    origin: flight.origin,
    destination: flight.destination,
    departureDate: tehranDay.format(new Date(flight.departure)),
    adultCount: String(counts.adults),
    childCount: String(counts.children),
    infantCount: String(counts.infants),
  });
  if (flight.return_leg) {
    query.set("returnDate", tehranDay.format(new Date(flight.return_leg.departure)));
  }
  for (const id of flight.product_ids) query.append("product", id);
  if (resultsSearch.startsWith("?") && resultsSearch.length <= 2048) query.set("search", resultsSearch.slice(1));
  return `${flightResultsPath}checkout/?${query}`;
}

type CheckoutParams = Record<string, string | string[] | undefined>;

export function parseFlightCheckoutParams(params: CheckoutParams) {
  const get = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const resultsQuery = new URLSearchParams(get("search")?.slice(0, 2048));
  resultsQuery.set("showResults", "1");
  const resultsHref = `${flightResultsPath}?${resultsQuery}`;
  const products = Array.isArray(params.product) ? params.product : params.product ? [params.product] : [];
  const origin = get("origin")?.trim();
  const destination = get("destination")?.trim();
  const departureDate = get("departureDate");
  const returnDate = get("returnDate");
  const validDate = (value?: string): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  if (!origin || origin.length > 160 || !destination || destination.length > 160 || !validDate(departureDate)
    || products.length !== (returnDate ? 2 : 1) || products.some(id => !id || id.length > 128)
    || (returnDate !== undefined && !validDate(returnDate))) {
    return { resultsHref, selection: null };
  }

  const lookup = new URLSearchParams({
    origin,
    destination,
    departureDate,
    tripType: returnDate ? "round_trip" : "one_way",
  });
  if (returnDate) lookup.set("returnDate", returnDate);
  const count = (key: string, minimum: number) => {
    const number = Number(get(key));
    return Number.isInteger(number) ? Math.min(20, Math.max(minimum, number)) : minimum;
  };
  return {
    resultsHref,
    selection: {
      lookup,
      products,
      counts: {
        adults: count("adultCount", 1),
        children: count("childCount", 0),
        infants: count("infantCount", 0),
      } satisfies PassengerCounts,
    },
  };
}
