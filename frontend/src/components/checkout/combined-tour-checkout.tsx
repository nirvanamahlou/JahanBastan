"use client";

import Link from "next/link";
import { Suspense, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { PassengerCheckoutModal, type PassengerCheckoutData } from "@/components/passenger-checkout-modal";
import { Dialog } from "@/components/ui/dialog";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { getTourPassengerCounts } from "@/lib/tour-passenger-counts";

type Props = {
  combinedDeparturePriceId: number;
  departureId: number;
  onClose: () => void;
  roomSelection: Record<string, number>;
  tourId: number;
};

export function CombinedTourCheckout({ combinedDeparturePriceId, departureId, onClose, roomSelection, tourId }: Props) {
  const [passengers, setPassengers] = useState<PassengerCheckoutData[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [bookingNumber, setBookingNumber] = useState("");
  const counts = getTourPassengerCounts([{ itemType: "tour", roomSelection }]);

  async function submit() {
    if (!passengers.length || !termsAccepted || busy || bookingNumber) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/bookings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combinedSelection: { itemType: "tour", tourId, tourDepartureId: departureId, combinedDeparturePriceId, roomSelection },
          termsAccepted,
          passengers: passengers.map((passenger) => ({
            ...passenger,
            age: passenger.age ? Number(passenger.age) : null,
            birthDate: passenger.birthDate || null,
            passportExpiryDate: passenger.passportExpiryDate || null,
            email: passenger.email || null,
            petWeightKg: passenger.hasPet && passenger.petWeightKg ? Number(passenger.petWeightKg) : null,
          })),
        }),
      });
      if (response.status === 401) {
        setSignIn(true);
        return;
      }
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.bookingNumber) {
        setNotice(typeof result?.detail === "string" ? result.detail : result?.detail?.message ?? "ثبت درخواست رزرو انجام نشد. دوباره تلاش کنید.");
        return;
      }
      setBookingNumber(result.bookingNumber);
    } catch {
      setNotice("ارتباط با سرور برقرار نشد.");
    } finally {
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
      ) : signIn ? (
        <Suspense fallback={null}>
          <AccountForm compact refreshAfterAuthentication={false} onAuthenticated={() => setSignIn(false)} />
        </Suspense>
      ) : (
        <div className="space-y-3">
          <PassengerCheckoutModal inline fixedPassengerCounts={counts} open={!passengers.length}
            onClose={onClose} onComplete={setPassengers} />
          {passengers.length ? (
            <div className="space-y-3">
              <button type="button" className="text-sm font-bold text-brand underline" onClick={() => setPassengers([])}>ویرایش اطلاعات مسافران</button>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                <span><Link href="/terms/" target="_blank" className="font-bold underline">شرایط خرید و استرداد</Link> را می‌پذیرم.</span>
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
