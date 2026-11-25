"use client";

import { useEffect, useRef, useState } from "react";
import { FlightRouteCard } from "./flight-route-card";

import type { FlightBuyerContact } from "@/components/passenger-checkout-modal";
import { flightCheckoutHref } from "@/lib/erp-flight-checkout-navigation";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { readCustomerSession } from "@/lib/customer-session";
import { formatCurrency } from "@/lib/currency";
import {
  checkoutRecoveryDisposition,
  discardPendingErpCheckout,
  readPendingErpCheckout,
  recoverPendingErpCheckout,
  type ErpFlightCheckoutResult as CheckoutResult,
  type PendingErpFlightCheckout as PendingCheckout,
} from "@/lib/erp-flight-checkout-recovery";
import type { PassengerCounts } from "@/lib/tour-passenger-counts";

type Airport = { name?: string | null; code?: string | null };

export type ErpFlightLeg = {
  product_id: string;
  offer_id: string;
  origin_id: string;
  destination_id: string;
  origin: string;
  destination: string;
  carrier: string;
  carrier_logo_sha256?: string | null;
  origin_airport?: Airport | null;
  destination_airport?: Airport | null;
  international?: boolean | null;
  remaining_capacity?: number | null;
  baggage_kg?: string | null;
  departure: string;
  arrival: string;
  service_number?: string | null;
  cabin_class_code: string;
};

export type ErpFlightRate = ErpFlightLeg & {
  product_ids: string[];
  return_leg?: ErpFlightLeg | null;
  amount: string;
  currency: string;
};

type CustomerSession = { user?: Partial<FlightBuyerContact> & { id?: number; phone?: string } };
const flightDate = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "full",
  timeZone: "Asia/Tehran",
});
const flightTime = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tehran",
});
const number = new Intl.NumberFormat("fa-IR");

export type FlightTimelineLeg = Pick<ErpFlightLeg,
  "origin" | "destination" | "carrier" | "carrier_logo_sha256" |
  "origin_airport" | "destination_airport" | "departure" | "arrival" |
  "service_number" | "baggage_kg"
> & { cabin_class_code?: string | null };

export function FlightTimeline({ leg, label, detailed = false, compact = false }: { leg: FlightTimelineLeg; label: string; detailed?: boolean; compact?: boolean }) {
  const departure = new Date(leg.departure);
  const arrival = new Date(leg.arrival);
  const date = flightDate.format(departure);
  const arrivalDate = flightDate.format(arrival);
  const minutes = Math.round((arrival.getTime() - departure.getTime()) / 60000);
  const duration = [
    minutes >= 60 ? `${number.format(Math.floor(minutes / 60))} ساعت` : "",
    minutes % 60 > 0 ? `${number.format(minutes % 60)} دقیقه` : "",
  ].filter(Boolean).join(" و ");

  return <FlightRouteCard
    compact={compact}
    label={label} date={date} carrier={leg.carrier}
    flightNumber={leg.service_number}
    cabin={leg.cabin_class_code === "ECONOMY" ? "اکونومی" : leg.cabin_class_code === "BUSINESS" ? "بیزینس" : leg.cabin_class_code === "FIRST" ? "فرست کلاس" : leg.cabin_class_code}
    duration={duration}
    baggage={leg.baggage_kg != null ? `${number.format(Number(leg.baggage_kg))} کیلوگرم` : null}
    origin={{ city: leg.origin, code: leg.origin_airport?.code, airport: detailed ? leg.origin_airport?.name : null, time: flightTime.format(departure), dateTime: leg.departure }}
    destination={{ city: leg.destination, code: leg.destination_airport?.code, airport: detailed ? leg.destination_airport?.name : null, time: minutes > 0 ? flightTime.format(arrival) : "—", dateTime: leg.arrival, date: date !== arrivalDate ? arrivalDate : undefined }}
  />;
}

export function ErpFlightResultCard({
  flight,
  passengerCounts,
  resultsSearch,
}: {
  flight: ErpFlightRate;
  passengerCounts: PassengerCounts;
  resultsSearch: string;
}) {
  const selectionAnchor = "flight-" + flight.product_ids.map(encodeURIComponent).join("_");
  const legs = [flight, ...(flight.return_leg ? [flight.return_leg] : [])];
  const capacities = legs.map((leg) => leg.remaining_capacity).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const seats = capacities.length ? Math.min(...capacities) : null;
  const soldOut = seats !== null && seats < 1;
  return (
    <article id={selectionAnchor} className="scroll-mt-28 target:ring-2 target:ring-brand overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_10.5rem]">
        <div className="min-w-0 px-3 py-2 sm:px-4">
          <div className="space-y-2">
            {legs.map((leg, index) => (
              <FlightTimeline key={leg.product_id} leg={leg} label={index === 0 ? "رفت" : "برگشت"} />
            ))}
          </div>
        </div>
        <aside className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-brand/10 bg-slate-50 px-3 py-2 lg:flex lg:flex-col lg:justify-center lg:border-s lg:border-t-0">
          <div className="min-w-0 lg:text-center">
            <span className="block text-xs leading-snug text-muted">{flight.return_leg ? "نرخ رفت‌وبرگشت یک بزرگسال" : "نرخ یک بزرگسال · یک‌طرفه"}</span>
            <strong className="block text-base leading-tight text-brand">{formatCurrency(flight.amount, flight.currency)}</strong>
            {seats !== null ? <span className="block text-xs leading-snug text-muted">{number.format(seats)} صندلی باقی‌مانده</span> : null}
          </div>
          {soldOut ? (
            <button className="min-h-10 rounded-md bg-brand px-3 text-xs font-black text-white opacity-60 lg:w-full lg:text-sm" disabled type="button">
              ظرفیت تکمیل است
            </button>
          ) : (
            <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-3 text-xs font-black text-white lg:w-full lg:text-sm"
              href={flightCheckoutHref(flight, passengerCounts, resultsSearch)}>
              انتخاب بلیت
            </a>
          )}
        </aside>
      </div>
    </article>
  );
}
export function ErpFlightCheckoutRecovery() {
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const customerId = useRef<number | null>(null);

  async function recover(saved: PendingCheckout, signal?: AbortSignal) {
    setBusy(true);
    setNotice("");
    try {
      const recovered = await recoverPendingErpCheckout(saved, {
        baseUrl: PUBLIC_API_BASE_URL,
        signal,
        onResult: setResult,
      });
      if (recovered?.state === "draft") {
        if (customerId.current) {
          discardPendingErpCheckout(window.localStorage, customerId.current);
        }
      } else if (!signal?.aborted) {
        setNotice(
          recovered?.message ||
            "بازیابی هنوز کامل نشده است؛ همین شناسه برای تلاش بعدی حفظ شد.",
        );
      }
    } catch (error) {
      if (!signal?.aborted) {
        setNotice(
          error instanceof Error ? error.message : "بازیابی پیش‌نویس انجام نشد.",
        );
      }
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const session = await readCustomerSession().catch(() => null);
      if (!session?.ok) return;
      const account = (await session
        .json()
        .catch(() => null)) as CustomerSession | null;
      const ownerId = account?.user?.id;
      if (!ownerId || controller.signal.aborted) return;
      customerId.current = ownerId;
      const saved = readPendingErpCheckout(window.localStorage, ownerId);
      if (!saved) return;
      setPending(saved);

    }
    void load();
    return () => controller.abort();
  }, []);

  function discardTerminalFailure() {
    if (!customerId.current || !result) return;
    if (checkoutRecoveryDisposition(result) !== "terminal") return;
    discardPendingErpCheckout(window.localStorage, customerId.current);
    setPending(null);
    setResult(null);
    setNotice("درخواست ناموفق حذف شد؛ اکنون می‌توانید پرواز دیگری را انتخاب کنید.");
  }

  if (!pending && !notice) return null;
  return (
    <section
      id="flight-request-recovery"
      className="scroll-mt-24 mb-5 rounded-2xl border border-brand/20 bg-white p-4 shadow-sm"
      aria-live="polite"
    >
      <strong className="text-brand">درخواست ناتمام پرواز آوینا</strong>
      {result?.state === "draft" ? (
        <p className="mt-2 text-sm text-emerald-800">
          پیش‌نویس ERP ثبت شده است. شماره قرارداد:{" "}
          <bdi dir="ltr">{result.contractNumber || "در حال همگام‌سازی"}</bdi>.{" "}
          {result.paymentMessage} <a className="underline" href={`/payment/waiting/?flight=${encodeURIComponent(result.id)}`}>وضعیت همین پرواز</a>
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            {notice ||
              result?.message ||
              "این درخواست با همان شناسه امن قابل بازیابی است."}
          </p>
          {result && checkoutRecoveryDisposition(result) === "terminal" ? (
            <button
              className="mt-3 min-h-11 rounded-xl border border-brand px-4 text-sm font-black text-brand"
              onClick={discardTerminalFailure}
              type="button"
            >
              حذف درخواست ناموفق و انتخاب دوباره
            </button>
          ) : pending ? (
            <button
              className="mt-3 min-h-11 rounded-xl bg-brand px-4 text-sm font-black text-white disabled:opacity-60"
              disabled={busy}
              onClick={() => void recover(pending)}
              type="button"
            >
              {busy ? "در حال پیگیری…" : "ادامه ثبت درخواست"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
