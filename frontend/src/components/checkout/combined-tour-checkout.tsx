"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { PassengerCheckoutModal, type PassengerCheckoutData } from "@/components/passenger-checkout-modal";
import { TourPriceBreakdown } from "@/components/content/tour-price-breakdown";
import { formatCurrency } from "@/lib/currency";
import { directTourAmount, finishDirectTourRequest, pendingDirectTourRequest } from "@/lib/direct-tour-request";
import type { TourPriceSummary } from "@/lib/currency-conversion";
import { Dialog } from "@/components/ui/dialog";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { readCustomerSession } from "@/lib/customer-session";
import { getTourPassengerCounts } from "@/lib/tour-passenger-counts";

type Props = {
  priceSummary: TourPriceSummary;
  country?: string | null;
  lastTravelDay?: string | null;
  combinedDeparturePriceId?: number;
  tourHotelPriceId?: number;
  departureId: number;
  onClose: () => void;
  roomSelection: Record<string, number>;
  tourId: number;
};

export function CombinedTourCheckout({ country, lastTravelDay, priceSummary, combinedDeparturePriceId, departureId, onClose, roomSelection, tourHotelPriceId, tourId }: Props) {
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
    if (!passengers.length || !termsAccepted || submitting.current || bookingNumber || payable === null || customerId.current === null) return;
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
      if (!response.ok || !result?.bookingNumber) {
        setNotice(typeof result?.detail === "string" ? result.detail : result?.detail?.message ?? "ثبت درخواست رزرو انجام نشد. دوباره تلاش کنید.");
        return;
      }
      finishDirectTourRequest(pending);
      setBookingNumber(result.bookingNumber);
    } catch {
      setNotice("ارتباط با سرور برقرار نشد.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open title={bookingNumber ? "درخواست رزرو ثبت شد" : "اطلاعات مسافران"} onClose={busy ? () => undefined : onClose}>
      {bookingNumber ? (
        <div className="space-y-3 text-sm">
          <p>شمارهٔ پیگیری <bdi>{bookingNumber}</bdi></p>
          <Link className="font-bold text-brand underline" href="/account/operations/">پیگیری درخواست رزرو</Link>
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
      ) : (
        <div className="space-y-3">
          <PassengerCheckoutModal inline lastTravelDay={lastTravelDay} requiresPassport={!!country?.trim() && !/^(ایران|ايران|iran|irn|ir)$/i.test(country.trim())} fixedPassengerCounts={counts} open={!passengers.length}
            onClose={onClose} onComplete={setPassengers} />
          {passengers.length ? (
            <div className="space-y-3">
              {revisedPrice ? <p className="text-sm font-bold text-brand">مبلغ نهایی به‌روز‌شده {formatCurrency(payable, "IRT")}</p> : <TourPriceBreakdown summary={priceSummary} />}
              <button type="button" className="text-sm font-bold text-brand underline" disabled={busy} onClick={() => {
                setPassengers([]);
                setConfirmedAmount(null);
                setNotice("");
              }}>ویرایش اطلاعات مسافران</button>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={busy} checked={termsAccepted} onChange={(event) => setConfirmedAmount(event.target.checked ? payable : null)} />
                <span><Link href="/terms/" target="_blank" className="font-bold underline">شرایط خرید و استرداد</Link> و مبلغ {formatCurrency(payable, "IRT")} را تأیید می‌کنم.</span>
              </label>
              <button type="button" disabled={busy || !termsAccepted} className="account-primary rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => void submit()}>
                {busy ? "در حال ثبت…" : "ثبت درخواست رزرو"}
              </button>
            </div>
          ) : null}
          {notice ? <p role="alert" className="text-sm text-red-700">{notice}</p> : null}
        </div>
      )}
    </Dialog>
  );
}
