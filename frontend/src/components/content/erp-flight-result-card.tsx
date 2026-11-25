"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { FlightRouteCard } from "./flight-route-card";
import { useRouter } from "next/navigation";

import { AccountForm } from "@/components/account-form";
import { Dialog } from "@/components/ui/dialog";

import {
  PassengerCheckoutModal,
  type FlightBuyerContact,
  type PassengerCheckoutData,
} from "@/components/passenger-checkout-modal";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { invalidateCustomerSession, readCustomerSession } from "@/lib/customer-session";
import { formatCurrency } from "@/lib/currency";
import {
  checkoutRecoveryDisposition,
  discardPendingErpCheckout,
  pendingCheckoutAction,
  readPendingErpCheckout,
  recoverPendingErpCheckout,
  savePendingErpCheckout,
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
type QuoteLine = {
  currencyCode: string;
  amount: string;
  category?: "ADT" | "CHD" | "INF";
  coverage?: "one_way" | "round_trip";
  leg?: number | null;
};
type QuoteReview = { quoteVersion: string; totals: QuoteLine[]; fares: QuoteLine[] };
const fareCategory = { ADT: "بزرگسال", CHD: "کودک", INF: "نوزاد" };
const tehranTravelDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
});

function passengerAgeLabel(birth: string, departure: string) {
  const day = tehranTravelDay.format(new Date(departure));
  const years = Number(day.slice(0, 4)) - Number(birth.slice(0, 4)) -
    Number(day.slice(5) < birth.slice(5));
  return fareCategory[years >= 12 ? "ADT" : years >= 2 ? "CHD" : "INF"];
}

function fareBreakdown(fares: QuoteLine[]) {
  const rows = new Map<string, { fare: QuoteLine; count: number }>();
  for (const fare of fares) {
    const key = JSON.stringify([fare.category, fare.currencyCode, fare.amount, fare.coverage, fare.leg]);
    const row = rows.get(key);
    if (row) row.count++;
    else rows.set(key, { fare, count: 1 });
  }
  return [...rows.entries()];
}

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

export function FlightTimeline({ leg, label, detailed = false }: { leg: FlightTimelineLeg; label: string; detailed?: boolean }) {
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
    label={label} date={date} carrier={leg.carrier}
    flightNumber={leg.service_number}
    cabin={leg.cabin_class_code === "ECONOMY" ? "اکونومی" : leg.cabin_class_code === "BUSINESS" ? "بیزینس" : leg.cabin_class_code === "FIRST" ? "فرست کلاس" : leg.cabin_class_code}
    duration={duration}
    baggage={leg.baggage_kg != null ? `${number.format(Number(leg.baggage_kg))} کیلوگرم` : null}
    origin={{ city: leg.origin, code: leg.origin_airport?.code, airport: detailed ? leg.origin_airport?.name : null, time: flightTime.format(departure), dateTime: leg.departure }}
    destination={{ city: leg.destination, code: leg.destination_airport?.code, airport: detailed ? leg.destination_airport?.name : null, time: minutes > 0 ? flightTime.format(arrival) : "—", dateTime: leg.arrival, date: date !== arrivalDate ? arrivalDate : undefined }}
  />;
}

function apiMessage(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }
  return "ثبت پیش‌نویس در ERP انجام نشد. دوباره تلاش کنید.";
}

export function ErpFlightResultCard({
  flight,
  passengerCounts,
}: {
  flight: ErpFlightRate;
  passengerCounts: PassengerCounts;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkingSelection, setCheckingSelection] = useState(false);
  const selectionInProgress = useRef(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [review, setReview] = useState<QuoteReview | null>(null);
  const [reviewPassengers, setReviewPassengers] = useState<PassengerCheckoutData[]>([]);
  const [buyer, setBuyer] = useState<FlightBuyerContact>();
  const [confirmed, setConfirmed] = useState(false);
  const preview = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = preview.current;
    if (review && dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, [review]);
  const key = useRef<string | null>(null);
  const savedPassengerIds = useRef<number[]>([]);
  const quoteVersion = useRef<string | undefined>(undefined);
  const customerId = useRef<number | null>(null);

  const selectionAnchor = "flight-" + flight.product_ids.map(encodeURIComponent).join("_");

  async function choose(verifiedSession?: Response) {
    if (selectionInProgress.current) return;
    selectionInProgress.current = true;
    setCheckingSelection(true);
    setNotice("");
    try {
      const session = verifiedSession ?? await readCustomerSession().catch(() => null);
      if (session?.status === 401 || session?.status === 403) {
        setAuthOpen(true);
      } else if (!session?.ok) {
        setNotice("بررسی وضعیت ورود انجام نشد. دوباره تلاش کنید.");
      } else {
        await continueSelection(session);
      }
    } finally {
      selectionInProgress.current = false;
      setCheckingSelection(false);
    }
  }

  async function continueSelection(session: Response) {
    const account = (await session
      .json()
      .catch(() => null)) as CustomerSession | null;
    if (!account?.user?.id) {
      setNotice("شناسه حساب برای ثبت پیش‌نویس در دسترس نیست.");
      return;
    }
    customerId.current = account.user.id;
    setBuyer({
      fullName: account.user.fullName ?? "",
      buyerMobile: account.user.buyerMobile ?? account.user.phone ?? "",
      address: account.user.address ?? "",
      landline: account.user.landline ?? "",
      postalCode: account.user.postalCode ?? "",
    });
    const pending = readPendingErpCheckout(
      window.localStorage,
      customerId.current,
    );
    if (pending) {
      setBusy(true);
      setNotice("");
      const status = await fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts/${encodeURIComponent(pending.key)}`, {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      const prior = await status?.json().catch(() => null);
      setBusy(false);
      const missing = status?.status === 404 && prior?.detail === "checkout not found";
      const finished = status?.ok && typeof prior?.state === "string" &&
        checkoutRecoveryDisposition(prior) !== "continue";
      const current = readPendingErpCheckout(window.localStorage, account.user.id);
      if (current && current.key !== pending.key) {
        setNotice("درخواست پرواز در برگهٔ دیگری تغییر کرد. دوباره تلاش کنید.");
        return;
      }
      if (missing || finished) {
        if (current) discardPendingErpCheckout(window.localStorage, account.user.id);
        setModalOpen(true);
        return;
      }
      if (!status?.ok || typeof prior?.state !== "string") {
        setNotice("وضعیت درخواست قبلی بررسی نشد. دوباره تلاش کنید.");
        return;
      }
      if (pendingCheckoutAction(pending, flight.product_ids) === "blocked") {
        setNotice("یک درخواست در حال پردازش دارید. وضعیت آن را در بخش سفرهای من بررسی کنید.");
        return;
      }
      key.current = pending.key;
      savedPassengerIds.current = pending.passengerIds;
      quoteVersion.current = pending.quoteVersion;
      await checkout();
      return;
    }
    setModalOpen(true);
  }

  async function saveBuyerContact() {
    if (!buyer) return;
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/me`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: buyer.fullName.trim(),
        buyerMobile: buyer.buyerMobile.trim(),
        address: buyer.address.trim(),
        landline: buyer.landline.trim() || null,
        postalCode: buyer.postalCode.trim() || null,
      }),
    });
    if (!response.ok) throw new Error("ذخیرهٔ اطلاعات خریدار در حساب کاربری انجام نشد.");
    invalidateCustomerSession();
  }

  async function reviewCheckout(passengers: PassengerCheckoutData[]) {
    if (!passengers.length || passengers.some((passenger) => !passenger.id)) {
      setNotice("اطلاعات همه مسافران باید ابتدا در حساب ذخیره شود.");
      return;
    }
    setModalOpen(false);
    setReview(null);
    setBusy(true);
    setNotice("");
    const passengerIds = passengers.map((passenger) => passenger.id as number);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts/review`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ productIds: flight.product_ids, passengerIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.quoteVersion || !Array.isArray(data?.totals)) {
        throw new Error(apiMessage(data));
      }
      savedPassengerIds.current = passengerIds;
      quoteVersion.current = data.quoteVersion;
      setReviewPassengers(passengers);
      setConfirmed(false);
      setReview(data as QuoteReview);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "استعلام نرخ انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    key.current ??= crypto.randomUUID();
    if (!savedPassengerIds.current.length) {
      setNotice("اطلاعات مسافران برای بازیابی این درخواست در دسترس نیست.");
      return;
    }
    if (!customerId.current) {
      setNotice("برای بازیابی امن درخواست، دوباره وارد حساب شوید.");
      return;
    }
    savePendingErpCheckout(window.localStorage, customerId.current, {
      key: key.current,
      productIds: flight.product_ids,
      passengerIds: savedPassengerIds.current,
      quoteVersion: quoteVersion.current,
    });
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(
        `${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts`,
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key.current,
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            productIds: flight.product_ids,
            passengerIds: savedPassengerIds.current,
            quoteVersion: quoteVersion.current,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        CheckoutResult | { detail?: unknown } | null;
      if (!response.ok) throw new Error(apiMessage(body));
      const checkoutResult = body as CheckoutResult;
      setResult(checkoutResult);
      setReview(null);
      setReviewPassengers([]);
      setModalOpen(false);
      if (checkoutResult.state === "draft") {
        discardPendingErpCheckout(window.localStorage, customerId.current);
        router.push(`/payment/waiting/?flight=${encodeURIComponent(checkoutResult.id)}`);
      } else if (checkoutResult.state === "failed" && checkoutResult.errorCode === "quote_changed") {
        discardPendingErpCheckout(window.localStorage, customerId.current);
        key.current = null;
        quoteVersion.current = undefined;
        setNotice(checkoutResult.message || "نرخ پرواز تغییر کرده است.");
        setModalOpen(true);
      } else {
        setNotice(
          checkoutResult.message ||
            "ثبت پیش‌نویس کامل نشد؛ همین دکمه را برای بازیابی امن بزنید.",
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ارتباط با ERP برقرار نشد.",
      );
    } finally {
      setBusy(false);
    }
  }

  const legs = [flight, ...(flight.return_leg ? [flight.return_leg] : [])];
  const capacities = legs.map((leg) => leg.remaining_capacity).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const seats = capacities.length ? Math.min(...capacities) : null;
  const soldOut = seats !== null && seats < 1 && !result?.retryable;
  return (
    <article id={selectionAnchor} className="scroll-mt-28 target:ring-2 target:ring-brand overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_10.5rem]">
        <div className="min-w-0 px-3 py-2 sm:px-4">
          <div className="space-y-2">
            {legs.map((leg, index) => (
              <FlightTimeline key={leg.product_id} leg={leg} label={index === 0 ? "رفت" : "برگشت"} />
            ))}
          </div>
          {notice ? (
            <p
              className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="status"
            >
              {notice}
            </p>
          ) : null}
          {result?.state === "draft" ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <strong>درخواست پرواز ثبت شد.</strong> <a className="mr-2 font-bold underline" href={`/payment/waiting/?flight=${encodeURIComponent(result.id)}`}>وضعیت همین پرواز</a>
              <p className="mt-1">
                شماره قرارداد:{" "}
                <bdi dir="ltr">
                  {result.contractNumber || "در حال همگام‌سازی"}
                </bdi>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-emerald-200 pt-3">
                <span>{result.paymentMessage}</span>
              </div>
            </div>
          ) : null}
        </div>
        <aside className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-brand/10 bg-slate-50 px-3 py-2 lg:flex lg:flex-col lg:justify-center lg:border-s lg:border-t-0">
          <div className="min-w-0 lg:text-center">
            <span className="block text-xs leading-snug text-muted">{flight.return_leg ? "نرخ رفت‌وبرگشت یک بزرگسال" : "نرخ یک بزرگسال · یک‌طرفه"}</span>
            <strong className="block text-base leading-tight text-brand">{formatCurrency(flight.amount, flight.currency)}</strong>
            {seats !== null ? <span className="block text-xs leading-snug text-muted">{number.format(seats)} صندلی باقی‌مانده</span> : null}
          </div>
          <button
            className="min-h-10 rounded-md bg-brand px-3 text-xs lg:w-full lg:text-sm font-black text-white disabled:opacity-60"
            disabled={soldOut || busy || checkingSelection || authOpen || modalOpen || Boolean(review) || result?.state === "draft"}
            onClick={() =>
              result?.retryable ? void checkout() : void choose()
            }
            type="button"
          >
            {busy
              ? "در حال ثبت پیش‌نویس…"
              : checkingSelection
                ? "در حال بررسی حساب…"
              : result?.state === "draft"
                ? "پیش‌نویس ثبت شد"
                : result?.retryable ? "تلاش دوباره" : soldOut ? "ظرفیت تکمیل است" : "انتخاب بلیت"}
          </button>
        </aside>
      </div>
      {review && <dialog dir="rtl" ref={preview} aria-labelledby="flight-review-heading" onCancel={(event) => {
        event.preventDefault();
        if (!busy) { setReview(null); setReviewPassengers([]); }
      }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-surface-muted text-foreground backdrop:bg-brand/40">
        <div className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-7">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brand px-6 py-5 text-white">
            <h2 id="flight-review-heading" className="text-2xl font-black">تأیید اطلاعات سفر</h2>
            <button type="button" disabled={busy} onClick={() => { setReview(null); setReviewPassengers([]); }} className="rounded-xl border border-white/40 px-4 py-2">بازگشت به نتایج</button>
          </header>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid min-w-0 gap-4 rounded-2xl bg-white p-4">
              <h3 className="font-black text-brand">اطلاعات بلیت</h3>
              <p className="text-sm text-muted">{flight.origin} ← {flight.destination} · {flightDate.format(new Date(flight.departure))}</p>
              <h3 className="font-black text-brand">مشخصات مسافران · {number.format(reviewPassengers.length)} نفر</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="bg-brand/5"><tr>{["مسافر", "نام مطابق گذرنامه", "جنسیت", "تاریخ تولد", "کد ملی / گذرنامه"].map((label) => <th key={label} scope="col" className="p-3 text-start">{label}</th>)}</tr></thead>
                  <tbody>{reviewPassengers.map((person, index) => (
                    <tr className="border-t border-border" key={person.id ?? index}>
                      <th scope="row" className="p-3 text-start">{person.firstName} {person.lastName}{person.birthDate && <span className="block text-xs font-normal text-muted">{passengerAgeLabel(person.birthDate, flight.departure)}</span>}</th>
                      <td className="p-3"><bdi>{[person.firstNameEn, person.lastNameEn].filter(Boolean).join(" ") || "—"}</bdi></td>
                      <td className="p-3">{person.gender === "male" ? "مرد" : person.gender === "female" ? "زن" : "—"}</td>
                      <td className="p-3">{person.birthDate ? flightDate.format(new Date(person.birthDate + "T12:00:00Z")) : "—"}</td>
                      <td className="p-3"><bdi>{person.nationalCode || "—"}</bdi>{person.passportNumber && <div>گذرنامه <bdi>{person.passportNumber}</bdi></div>}{person.passportExpiryDate && <div>انقضا {flightDate.format(new Date(person.passportExpiryDate + "T12:00:00Z"))}</div>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {buyer?.fullName && <section className="rounded-xl border border-border p-4">
                <h3 className="font-black text-brand">اطلاعات تماس خریدار</h3>
                <p className="mt-2">{buyer.fullName}{buyer.buyerMobile && <> · <bdi>{buyer.buyerMobile}</bdi></>}</p>
                {buyer.address && <p className="mt-1 text-sm text-muted">{buyer.address}</p>}
                {buyer.landline && <p className="mt-1 text-sm text-muted">تلفن ثابت · <bdi>{buyer.landline}</bdi></p>}
                {buyer.postalCode && <p className="mt-1 text-sm text-muted">کد پستی · <bdi>{buyer.postalCode}</bdi></p>}
              </section>}
              {review.fares?.length ? (
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="w-full min-w-80 text-start text-sm">
                    <caption className="px-3 py-2 text-start font-bold text-brand">تفکیک قیمت مسافران</caption>
                    <thead className="bg-brand/5"><tr>{["مسافر", "تعداد", "مبلغ هر نفر", "جمع"].map((label) => <th key={label} scope="col" className="p-2 text-start">{label}</th>)}</tr></thead>
                    <tbody>{fareBreakdown(review.fares).map(([key, { fare, count }]) => (
                      <tr key={key} className="border-t border-border">
                        <th scope="row" className="p-2 text-start">{fare.category ? fareCategory[fare.category] : "مسافر"} · {fare.coverage === "round_trip" ? "رفت‌وبرگشت" : fare.leg === 2 ? "برگشت" : "رفت"}</th>
                        <td className="p-2">{number.format(count)}</td>
                        <td className="p-2">{formatCurrency(fare.amount, fare.currencyCode)}</td>
                        <td className="p-2 font-bold">{formatCurrency(Number(fare.amount) * count, fare.currencyCode)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : null}
            </div>
            <aside className="grid gap-4 rounded-2xl border border-border bg-white p-5 lg:sticky lg:top-5">
              <div><p className="text-sm text-muted">مبلغ کل مسافران</p><strong className="mt-1 block text-xl text-brand">{review.totals.map((total) => formatCurrency(total.amount, total.currencyCode)).join(" + ")}</strong></div>
              <label className="flex items-start gap-2 rounded-xl bg-brand/5 p-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4 accent-brand" />اطلاعات پرواز و مسافران را بررسی و تأیید می‌کنم.</label>
              {notice && <p role="alert" className="text-sm text-red-800">{notice}</p>}
              <button type="button" disabled={!confirmed || busy} onClick={() => void checkout()} className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white disabled:opacity-50">{busy ? "در حال ثبت…" : "تأیید اطلاعات و ثبت درخواست"}</button>
            </aside>
          </div>
        </div>
      </dialog>}
      {authOpen && (
        <Dialog open compact title="ورود و ثبت‌نام" onClose={() => setAuthOpen(false)}>
          <Suspense fallback={null}>
            <AccountForm
              compact
              refreshAfterAuthentication={false}
              onAuthenticated={(session) => {
                setAuthOpen(false);
                void choose(session);
              }}
            />
          </Suspense>
        </Dialog>
      )}
      <PassengerCheckoutModal
        buyerContact={buyer}
        onBuyerContactChange={setBuyer}
        saveBuyerContact={saveBuyerContact}
        context="flight"
        availableSeats={seats}
        requiresPassport={legs.some(leg => leg.international === true)}
        lastTravelDay={tehranTravelDay.format(new Date(legs[legs.length - 1].arrival))}
        fixedPassengerCounts={passengerCounts}
        onClose={() => setModalOpen(false)}
        onComplete={(passengers) => void reviewCheckout(passengers)}
        open={modalOpen}
      />
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
