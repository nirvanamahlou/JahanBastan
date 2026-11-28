"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TravelCheckout } from "./travel-checkout";
import { Suspense, useEffect, useRef, useState } from "react";

import { CartAddButton } from "@/components/customer-commerce-actions";
import { AccountForm } from "@/components/account-form";
import { PassengerCheckoutModal, type PassengerCheckoutData } from "@/components/passenger-checkout-modal";
import { TourPriceBreakdown } from "@/components/content/tour-price-breakdown";
import { formatPersianDate } from "@/lib/persian-date";
import { formatCurrency } from "@/lib/currency";
import { directTourAmount, finishDirectTourRequest, pendingDirectTourRequest } from "@/lib/direct-tour-request";
import type { TourPriceSummary } from "@/lib/currency-conversion";
import { FlightCheckoutSteps } from "@/components/content/flight-checkout-steps";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { readCustomerSession } from "@/lib/customer-session";
import { getTourPassengerCounts } from "@/lib/tour-passenger-counts";

export type TourCheckoutSelection = {
  hotelSummary?: string;
  departureDate?: string | null;
  priceSummary: TourPriceSummary;
  country?: string | null;
  lastTravelDay?: string | null;
  combinedDeparturePriceId?: number;
  tourHotelPriceId?: number;
  departureId: number;
  roomSelection: Record<string, number>;
  tourId: number;
};

export function CombinedTourCheckout({ hotelSummary, departureDate, country, lastTravelDay, priceSummary, combinedDeparturePriceId, departureId, roomSelection, tourHotelPriceId, tourId }: TourCheckoutSelection) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartItem, setCartItem] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [passengers, setPassengers] = useState<PassengerCheckoutData[]>([]);
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
  const [sessionState, setSessionState] = useState<"loading" | "signIn" | "ready" | "error">("loading");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const customerId = useRef<number | null>(null);
  const [revisedPrice, setRevisedPrice] = useState<{ total: number | null } | null>(null);
  const payable = revisedPrice ? revisedPrice.total : directTourAmount(priceSummary.total);
  const termsAccepted = payable !== null && confirmedAmount === payable;
  const [notice, setNotice] = useState("");
  const [bookingNumber, setBookingNumber] = useState("");
  const counts = getTourPassengerCounts([{ itemType: "tour", roomSelection }]);

  useEffect(() => {
    let active = true;
    void readCustomerSession().then(async response => {
      const session = response.ok ? await response.json() : null;
      if (!active) return;
      if (response.status === 401 || response.status === 403) { setSessionState("signIn"); return; }
      const id = session?.user?.id;
      if (!Number.isSafeInteger(id) || id < 1) { setSessionState("error"); return; }
      if (customerId.current !== null && customerId.current !== id) {
        setPassengers([]);
        setConfirmedAmount(null);
        setRevisedPrice(null);
        setNotice("");
      }
      customerId.current = id;
      setSessionState("ready");
    }).catch(() => { if (active) setSessionState("error"); });
    return () => { active = false; };
  }, [sessionAttempt]);

  function checkSession() {
    setSessionState("loading");
    setSessionAttempt(attempt => attempt + 1);
  }

  async function submit() {
    if (addingToCart || !passengers.length || !termsAccepted || submitting.current || bookingNumber || payable === null || customerId.current === null) return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    try {
      const payload = {
        acceptedTotalIrt: payable,
        tourSelection: { itemType: "tour", tourId, tourDepartureId: departureId, combinedDeparturePriceId, tourHotelPriceId, roomSelection: Object.fromEntries(Object.entries(roomSelection).sort(([a], [b]) => a.localeCompare(b))) },
        termsAccepted,
        passengers: passengers.map((passenger) => ({
          ...passenger,
          fatherName: passenger.fatherName || null,
          firstNameEn: passenger.firstNameEn || null,
          lastNameEn: passenger.lastNameEn || null,
          age: passenger.age ? Number(passenger.age) : null,
          birthDate: passenger.birthDate || null,
          passportExpiryDate: passenger.passportExpiryDate || null,
          email: passenger.email || null,
          petWeightKg: passenger.hasPet && passenger.petWeightKg ? Number(passenger.petWeightKg) : null,
        })),
      };
      const pending = await pendingDirectTourRequest(customerId.current, JSON.stringify(payload));
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/bookings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, directRequestKey: pending.requestKey }),
      });
      if (response.status === 401) {
        setSessionState("signIn");
        return;
      }
      const result = await response.json().catch(() => null);
      if (response.status === 409 && result?.detail?.code === "price_changed") {
        finishDirectTourRequest(pending);
        setConfirmedAmount(null);
        setRevisedPrice({ total: directTourAmount(result.detail.finalTotalIrt) });
        setNotice("قیمت تور تغییر کرده است. مبلغ جدید را پیش از ثبت بررسی کنید.");
        return;
      }
      if (!response.ok || !result?.bookingNumber || !Number.isSafeInteger(result.id) || result.id < 1) {
        setNotice(typeof result?.detail === "string" ? result.detail : result?.detail?.message ?? "ثبت درخواست رزرو انجام نشد. دوباره تلاش کنید.");
        return;
      }
      finishDirectTourRequest(pending);
      setBookingNumber(result.bookingNumber);
      setBookingId(result.id);
      router.push(`/payment/waiting/?booking=${result.id}`);
    } catch {
      setNotice("ارتباط با سرور برقرار نشد.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <FlightCheckoutSteps current={bookingNumber || cartItem ? 2 : passengers.length && !editing ? 1 : 0} label="مراحل رزرو تور" />
      {bookingNumber ? (
        <div className="space-y-3 text-sm">
          <p>شمارهٔ پیگیری <bdi>{bookingNumber}</bdi></p>
          <Link className="font-bold text-brand underline" href={`/payment/waiting/?booking=${bookingId}`}>وضعیت همین سفارش و پرداخت</Link>
        </div>
      ) : payable === null ? (
        <div className="space-y-3" role="status">
          <p>قیمت نهایی این تور نیاز به استعلام دارد.</p>
          <Link className="font-bold text-brand underline" href="/contact/">تماس با کارشناسان</Link>
        </div>
      ) : sessionState === "loading" ? <p role="status">در حال بررسی حساب کاربری…</p>
        : sessionState === "error" ? <div role="alert">ارتباط با سرور برقرار نشد. <button type="button" onClick={checkSession}>تلاش دوباره</button></div>
        : sessionState === "signIn" ? (
        <Suspense fallback={null}>
          <AccountForm compact refreshAfterAuthentication={false} onAuthenticated={checkSession} />
        </Suspense>
      ) : cartItem ? <TravelCheckout selection={{itemId: cartItem, passengers}} /> : (
        <div className="space-y-3">
          <PassengerCheckoutModal inline lastTravelDay={lastTravelDay} requiresPassport={!!country?.trim() && !/^(ایران|ايران|iran|irn|ir)$/i.test(country.trim())} fixedPassengerCounts={counts} initialPassengers={passengers} open={editing || !passengers.length}
            onClose={() => undefined} onComplete={value => { setPassengers(value); setEditing(false); setConfirmedAmount(null); }} />
          {passengers.length && !editing ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <h2 className="text-lg font-black text-brand sm:col-span-2">بازبینی مسافران و مبلغ</h2>
              <section className="min-w-0 space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950 shadow-sm">
                <h3 className="text-sm font-bold">اقامت و تاریخ سفر</h3>
                {hotelSummary && <p className="break-words font-bold"><bdi>{hotelSummary}</bdi></p>}
                {departureDate && <p className="text-sm">{formatPersianDate(departureDate)}{lastTravelDay && lastTravelDay !== departureDate && ` تا ${formatPersianDate(lastTravelDay)}`}</p>}
              </section>
              <section className="min-w-0 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
                <h3 className="text-sm font-bold">خلاصهٔ هزینه</h3>
                {revisedPrice ? <p className="font-black">مبلغ نهایی به‌روز‌شده {formatCurrency(payable, "IRT")}</p> : <TourPriceBreakdown summary={priceSummary} />}
              </section>
              <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-violet-950">مسافران ({passengers.length.toLocaleString("fa-IR")})</h3>
                  <button type="button" className="min-h-10 text-sm font-bold text-brand underline" disabled={busy || addingToCart} onClick={() => {
                    setEditing(true);
                    setConfirmedAmount(null);
                    setNotice("");
                  }}>ویرایش اطلاعات مسافران</button>
                </div>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">{passengers.map((person, i) => (
                  <li className="grid min-w-0 gap-1 rounded-xl border border-violet-100 bg-white p-3" key={i}>
                    <strong className="break-words text-sm text-brand"><bdi>{person.firstNameEn || person.firstName} {person.lastNameEn || person.lastName}</bdi></strong>
                    <span className="text-xs text-muted">{person.passportNumber ? "گذرنامه" : "کد ملی"} · <bdi>{person.passportNumber || person.nationalCode}</bdi></span>
                  </li>
                ))}</ul>
              </section>
              <CartAddButton className="sm:col-span-2" itemType="tour" tourId={tourId} tourDepartureId={departureId} tourHotelPriceId={tourHotelPriceId}
                combinedDeparturePriceId={combinedDeparturePriceId} roomSelection={roomSelection} disabled={busy}
                onPendingChange={setAddingToCart} onAdded={setCartItem} idleLabel="انتخاب اقساط، اعتبار آژانس یا کد تخفیف" />
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" disabled={busy} checked={termsAccepted} onChange={(event) => setConfirmedAmount(event.target.checked ? payable : null)} />
                <span><Link href="/terms/" target="_blank" className="font-bold underline">شرایط خرید و استرداد</Link> و مبلغ {formatCurrency(payable, "IRT")} را تأیید می‌کنم.</span>
              </label>
              <button type="button" disabled={busy || addingToCart || !termsAccepted} className="account-primary min-h-11 rounded-xl bg-brand px-4 py-2 sm:col-span-2 text-sm text-white disabled:opacity-50" onClick={() => void submit()}>
                {busy ? "در حال ثبت…" : "ثبت درخواست رزرو"}
              </button>
            </div>
          ) : null}
          {notice ? <p role="alert" className="text-sm text-red-700">{notice}</p> : null}
        </div>
      )}
    </div>
  );
}
