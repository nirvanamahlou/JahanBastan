import { apiGet } from "@/lib/api/client";

type FlightLeg = { id: string; origin: string; destination: string; carrier: string; departure: string; service_number?: string | null };

type FlightRate = FlightLeg & { amount: string; currency: string; return_leg?: FlightLeg | null };

const dateFormat = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" });

function Leg({ leg }: { leg: FlightLeg }) {
  return <p>{leg.origin} به {leg.destination} · {leg.carrier} {leg.service_number} · {dateFormat.format(new Date(leg.departure))}</p>;
}

export async function RubiFlightRates() {
  const flights = await apiGet<FlightRate[]>("/erp/flight-rates", { cache: "no-store" }).catch(() => []);
  if (!flights.length) return null;
  return (
    <section className="mb-6 space-y-3" aria-label="نرخ پروازهای جهان باستان">
      <h2 className="text-lg font-bold">نرخ پروازهای جهان باستان</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {flights.map((flight) => (
          <li key={flight.id} className="rounded-xl border p-3">
            <strong>{flight.return_leg ? "رفت‌وبرگشت" : "یک‌طرفه"}</strong>
            <Leg leg={flight} />
            {flight.return_leg && <Leg leg={flight.return_leg} />}
            <p>{flight.return_leg ? "نرخ مجموع رفت‌وبرگشت بزرگسال" : "نرخ بزرگسال"} {flight.amount} {flight.currency}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
