"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { FlightCheckoutSteps } from "@/components/content/flight-checkout-steps";
import { FlightTimeline, type ErpFlightRate } from "@/components/content/erp-flight-result-card";
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
  savePendingErpCheckout,
  type ErpFlightCheckoutResult as CheckoutResult,
} from "@/lib/erp-flight-checkout-recovery";
import type { PassengerCounts } from "@/lib/tour-passenger-counts";

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
  dateStyle: "long",
  timeZone: "Asia/Tehran",
});
const number = new Intl.NumberFormat("fa-IR");

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

type Phase = "loading" | "auth" | "passengers" | "review" | "resume" | "blocked";

export function ErpFlightCheckout({ flight, passengerCounts, resultsHref }: {
  flight: ErpFlightRate;
  passengerCounts: PassengerCounts;
  resultsHref: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState<QuoteReview | null>(null);
  const [initialPassengers, setInitialPassengers] = useState<PassengerCheckoutData[]>();
  const [reviewPassengers, setReviewPassengers] = useState<PassengerCheckoutData[]>([]);
  const [buyer, setBuyer] = useState<FlightBuyerContact>();
  const [confirmed, setConfirmed] = useState(false);
  const key = useRef<string | null>(null);
  const savedPassengerIds = useRef<number[]>([]);
  const quoteVersion = useRef<string | undefined>(undefined);
  const customerId = useRef<number | null>(null);

  const legs = [flight, ...(flight.return_leg ? [flight.return_leg] : [])];
  const capacities = legs.map((leg) => leg.remaining_capacity).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const seats = capacities.length ? Math.min(...capacities) : null;


  async function prepare(session: Response | null, signal?: AbortSignal) {
    if (signal?.aborted) return;
    if (session?.status === 401 || session?.status === 403) {
      setPhase("auth");
      return;
    }
    if (!session?.ok) {
      setNotice("بررسی وضعیت ورود انجام نشد. دوباره تلاش کنید.");
      setPhase("blocked");
      return;
    }
    const account = (await session
      .json()
      .catch(() => null)) as CustomerSession | null;
    if (signal?.aborted) return;
    if (!account?.user?.id) {
      setNotice("شناسه حساب برای ثبت پیش‌نویس در دسترس نیست.");
      setPhase("blocked");
      return;
    }
    customerId.current = account.user.id;
    const accountName = account.user.fullName?.trim() ?? "";
    setBuyer({
      fullName: accountName === "کاربر جهان باستان" ? "" : accountName,
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
      const status = await fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts/${encodeURIComponent(pending.key)}`, {
        credentials: "include",
        cache: "no-store",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
      }).catch(() => null);
      const prior = await status?.json().catch(() => null);
      if (signal?.aborted) return;
      const missing = status?.status === 404 && prior?.detail === "checkout not found";
      if (status?.ok && prior?.state === "draft" && typeof prior.id === "string" &&
          pendingCheckoutAction(pending, flight.product_ids) === "resume") {
        const current = readPendingErpCheckout(window.localStorage, account.user.id);
        if (!current || current.key === pending.key) {
          discardPendingErpCheckout(window.localStorage, account.user.id);
          router.replace(`/payment/waiting/?flight=${encodeURIComponent(prior.id)}`);
          return;
        }
      }
      const finished = status?.ok && typeof prior?.state === "string" &&
        checkoutRecoveryDisposition(prior) !== "continue";
      const current = readPendingErpCheckout(window.localStorage, account.user.id);
      if (current && current.key !== pending.key) {
        setNotice("درخواست پرواز در برگهٔ دیگری تغییر کرد. دوباره تلاش کنید.");
        setPhase("blocked");
        return;
      }
      if (missing || finished) {
        if (current) discardPendingErpCheckout(window.localStorage, account.user.id);
        setPhase("passengers");
        return;
      }
      if (!status?.ok || typeof prior?.state !== "string") {
        setNotice("وضعیت درخواست قبلی بررسی نشد. دوباره تلاش کنید.");
        setPhase("blocked");
        return;
      }
      if (pendingCheckoutAction(pending, flight.product_ids) === "blocked") {
        setNotice("یک درخواست در حال پردازش دارید. وضعیت آن را در بخش سفرهای من بررسی کنید.");
        setPhase("blocked");
        return;
      }
      key.current = pending.key;
      savedPassengerIds.current = pending.passengerIds;
      quoteVersion.current = pending.quoteVersion;
      setPhase("resume");
      return;
    }
    setPhase("passengers");
  }


  const prepareSession = useEffectEvent(prepare);
  useEffect(() => {
    const controller = new AbortController();
    void readCustomerSession().catch(() => null).then(session => prepareSession(session, controller.signal));
    return () => controller.abort();
  }, [sessionAttempt]);

  useEffect(() => {
    if (phase === "review") window.scrollTo(0, 0);
  }, [phase]);

  async function checkFlightCapacity(birthDates: string[]) {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts/capacity`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({ productIds: flight.product_ids, birthDates }),
    }).catch(() => null);
    if (response?.status === 204) return;
    const data = await response?.json().catch(() => null);
    throw new Error(typeof data?.detail === "string" ? data.detail : "ظرفیت پرواز تأیید نشد. دوباره تلاش کنید.");
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
      setInitialPassengers(passengers);
      setConfirmed(false);
      setReview(data as QuoteReview);
      setPhase("review");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "استعلام نرخ انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (busy) return;
    key.current ??= crypto.randomUUID();
    if (!savedPassengerIds.current.length) {
      setNotice("اطلاعات مسافران برای بازیابی این درخواست در دسترس نیست.");
      return;
    }
    if (!customerId.current) {
      setNotice("برای بازیابی امن درخواست، دوباره وارد حساب شوید.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      savePendingErpCheckout(window.localStorage, customerId.current, {
        key: key.current,
        productIds: flight.product_ids,
        passengerIds: savedPassengerIds.current,
        quoteVersion: quoteVersion.current,
      });
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
      if (checkoutResult.state === "draft") {
        discardPendingErpCheckout(window.localStorage, customerId.current);
        router.replace(`/payment/waiting/?flight=${encodeURIComponent(checkoutResult.id)}`);
      } else if (checkoutRecoveryDisposition(checkoutResult) === "terminal" || checkoutResult.errorCode === "quote_changed") {
        discardPendingErpCheckout(window.localStorage, customerId.current);
        key.current = null;
        quoteVersion.current = undefined;
        setReview(null);
        setPhase("passengers");
        setNotice(checkoutResult.message || "ثبت درخواست انجام نشد. اطلاعات را دوباره بررسی کنید.");
      } else {
        setPhase("resume");
        setNotice(checkoutResult.message || "ثبت درخواست کامل نشده است.");
      }
    } catch (error) {
      setPhase("resume");
      setNotice(error instanceof Error ? error.message : "ارتباط با سامانه رزرو برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }


  const editableCounts = initialPassengers ? {
    adults: initialPassengers.filter(person => person.passengerType === "adult").length,
    children: initialPassengers.filter(person => person.passengerType === "child").length,
    infants: initialPassengers.filter(person => person.passengerType === "infant").length,
  } : passengerCounts;
  const activeStep = phase === "review" || phase === "resume" ? 1 : 0;
  return (
    <div className="grid gap-3" data-flight-checkout>
      <FlightCheckoutSteps current={activeStep} />
      <section className="rounded-xl border border-border bg-surface px-3 py-2 sm:px-4" aria-label="پرواز انتخاب‌شده">
        <h2 className="mb-1.5 text-sm font-bold text-brand">پرواز انتخاب‌شده</h2>
        <div className={legs.length > 1 ? "grid gap-3 sm:grid-cols-2" : ""}>
          {legs.map((leg, index) => <FlightTimeline compact key={leg.product_id} leg={leg} label={index === 0 ? "رفت" : "برگشت"} />)}
        </div>
      </section>
      {notice && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
      {phase === "loading" && <p role="status" className="text-sm text-muted">در حال بررسی حساب و پرواز…</p>}
      {phase === "auth" && (
        <section className="mx-auto grid w-full gap-3 rounded-xl border border-border bg-surface p-4 sm:max-w-md sm:p-6">
          <h2 className="text-lg font-bold text-brand">ورود و ثبت‌نام</h2>
          <Suspense fallback={null}>
            <AccountForm compact refreshAfterAuthentication={false} onAuthenticated={(session) => {
              setPhase("loading");
              void prepare(session);
            }} />
          </Suspense>
        </section>
      )}
      {phase === "blocked" && <button type="button" className="justify-self-start rounded-lg border border-brand px-4 py-2 text-sm font-bold text-brand" onClick={() => {
        setNotice("");
        setPhase("loading");
        setSessionAttempt(value => value + 1);
      }}>بررسی دوباره</button>}
      {phase === "passengers" && (seats !== null && seats < 1
        ? <p role="status" className="rounded-xl border border-border p-3 text-sm text-muted">ظرفیت این پرواز تکمیل شده است.</p>
        : (
        <PassengerCheckoutModal
          inline
          initialPassengers={initialPassengers}
          buyerContact={buyer}
          onBuyerContactChange={setBuyer}
          saveBuyerContact={saveBuyerContact}
          checkFlightCapacity={checkFlightCapacity}
          context="flight"
          availableSeats={seats}
          requiresPassport={legs.some(leg => leg.international === true)}
          lastTravelDay={tehranTravelDay.format(new Date(legs[legs.length - 1].arrival))}
          fixedPassengerCounts={editableCounts}
          onClose={() => router.push(resultsHref)}
          onComplete={(passengers) => void reviewCheckout(passengers)}
          open
        />
        )
      )}
      {phase === "review" && review && (
        <section aria-labelledby="flight-review-heading" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="flight-review-heading" className="text-xl font-black text-brand">تأیید اطلاعات سفر</h2>
            <button type="button" disabled={busy} onClick={() => { setPhase("passengers"); setConfirmed(false); }} className="rounded-lg border border-border px-3 py-2 text-sm font-bold text-brand">ویرایش اطلاعات مسافران</button>
          </div>
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
          <button type="button" disabled={!confirmed || busy} onClick={() => void checkout()} className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white disabled:opacity-50">{busy ? "در حال ثبت…" : "تأیید اطلاعات و ثبت درخواست"}</button>
        </aside>
      </div>
        </section>
      )}
      {phase === "resume" && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold text-brand">ادامهٔ درخواست پرواز</h2>
          <button type="button" disabled={busy} onClick={() => void checkout()} className="mt-2 min-h-10 rounded-lg bg-brand px-4 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "در حال پیگیری…" : "ادامه ثبت درخواست"}
          </button>
        </div>
      )}
      <Link className="justify-self-start text-sm font-bold text-brand underline underline-offset-4" href={resultsHref}>بازگشت به نتایج پرواز</Link>
    </div>
  );
}
