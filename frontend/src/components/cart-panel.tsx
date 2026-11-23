"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  PassengerCheckoutData,
  PassengerCheckoutModal,
} from "@/components/passenger-checkout-modal";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { notifyCartUpdated } from "@/lib/guest-cart";
import { getTourPassengerCounts } from "@/lib/tour-passenger-counts";

type CartItem = {
  id: number;
  itemType: "tour" | "flight" | "train" | "bus";
  titleSnapshot: string;
  detailsSnapshot: string | null;
  priceAmount: string | null;
  currency: string | null;
  hotelAmount: string | null;
  hotelCurrency: string | null;
  flightAmount: string | null;
  flightCurrency: string | null;
  roomSelection: Record<string, number>;
  imageId: number | null;
};

type Booking = {
  id: number;
  bookingNumber: string;
  status: string;
  totalAmount: string | null;
  currency: string;
  adminNote: string | null;
  paymentExpiresAt: string | null;
  tickets: BookingTicket[];
};
type BookingTicket = {
  id: number;
  ticketNumber: string;
  passengerIndex: number;
  firstName: string;
  lastName: string;
  serviceTitle: string;
  route: string;
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureDate: string | null;
  departureTime: string | null;
  carrier: string | null;
  travelClass: string | null;
  baggageAllowance: string | null;
};
type HotelAlternative = {
  offerId: number;
  hotelName: string;
  hotelSlug: string;
  tourSlug: string;
  stars: number;
  region: string | null;
  roomType: string;
  serviceType: string;
  price: string;
  currency: string;
};

const statusLabels: Record<string, string> = {
  pending_review: "در انتظار بررسی پشتیبان",
  approved: "تأییدشده و آماده پرداخت",
  rejected: "ردشده",
  expired: "باطل‌شده؛ مهلت پرداخت پایان یافته",
  paid: "پرداخت‌شده",
};

const roomLabels: Record<string, string> = {
  double: "اتاق دو تخته",
  single: "اتاق یک تخته",
  childWithBed: "کودک با تخت",
  childWithoutBed: "کودک بدون تخت",
  infant: "نوزاد",
};

function roomSelectionLabel(key: string, count: number) {
  if (key === "double") {
    return `${roomLabels[key]}: ${(count * 2).toLocaleString("fa-IR")} نفر (${count.toLocaleString("fa-IR")} اتاق)`;
  }
  return `${roomLabels[key] ?? key}: ${count.toLocaleString("fa-IR")}`;
}

function money(value: string | null, currency: string | null) {
  return value && currency ? formatCurrency(value, currency) : "پس از بررسی پشتیبان";
}

export function CartPanel() {
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [alternatives, setAlternatives] = useState<HotelAlternative[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [passengerFlowOpen, setPassengerFlowOpen] = useState(false);
  const [passengerDetails, setPassengerDetails] = useState<PassengerCheckoutData[]>([]);

  async function load() {
    const [cartResponse, bookingResponse] = await Promise.all([
      fetch(PUBLIC_API_BASE_URL + "/account/cart", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null),
      fetch(PUBLIC_API_BASE_URL + "/account/bookings", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null),
    ]);
    if (cartResponse?.status === 401) {
      setUnauthenticated(true);
      setItems([]);
      return;
    }
    setItems(cartResponse?.ok ? (await cartResponse.json()) as CartItem[] : []);
    setBookings(bookingResponse?.ok ? (await bookingResponse.json()) as Booking[] : []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const hasJustExpired = bookings.some(
      (booking) => booking.status === "approved" && booking.paymentExpiresAt
        && new Date(booking.paymentExpiresAt).getTime() <= now,
    );
    if (!hasJustExpired) return;
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [bookings, now]);

  useEffect(() => {
    if (!items?.length) return;
    if (new URLSearchParams(window.location.search).get("passengerFlow") !== "1") return;
    const timer = window.setTimeout(() => setPassengerFlowOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [items]);

  const componentTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items ?? []) {
      for (const [amount, currency] of [
        [item.hotelAmount, item.hotelCurrency],
        [item.flightAmount, item.flightCurrency],
      ] as const) {
        if (amount && currency) {
          totals.set(currency, (totals.get(currency) ?? 0) + Number(amount));
        }
      }
      if (!item.hotelAmount && !item.flightAmount && item.priceAmount && item.currency) {
        totals.set(item.currency, (totals.get(item.currency) ?? 0) + Number(item.priceAmount));
      }
    }
    return [...totals.entries()];
  }, [items]);
  const fixedTourPassengerCounts = useMemo(
    () => getTourPassengerCounts(items ?? []),
    [items],
  );

  async function remove(id: number) {
    const response = await fetch(PUBLIC_API_BASE_URL + "/account/cart/" + id, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    if (response?.ok) {
      setItems((current) => current?.filter((item) => item.id !== id) ?? []);
      setPassengerDetails([]);
      notifyCartUpdated();
    }
  }

  async function submitBooking() {
    if (!items?.length) return;
    const requiresPassengerInfo = items.length > 0;
    if (requiresPassengerInfo && !passengerDetails.length) {
      setPassengerFlowOpen(true);
      setNotice("برای ثبت سفارش، ابتدا اطلاعات همهٔ مسافران را وارد کنید.");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(PUBLIC_API_BASE_URL + "/account/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengers: passengerDetails.map((passenger) => ({
            id: passenger.id,
            passengerType: passenger.passengerType,
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            fatherName: passenger.fatherName || null,
            fullName: `${passenger.firstName} ${passenger.lastName}`.trim(),
            firstNameEn: passenger.firstNameEn || null,
            lastNameEn: passenger.lastNameEn || null,
            nationalCode: passenger.nationalCode || null,
            passportNumber: passenger.passportNumber || null,
            passportExpiryDate: passenger.passportExpiryDate || null,
            email: passenger.email || null,
            gender: passenger.gender,
            age: passenger.age ? Number(passenger.age) : null,
            birthDate: passenger.birthDate || null,
            phone: passenger.phone || null,
          hasPet: passenger.hasPet,
          petName: passenger.hasPet ? passenger.petName || null : null,
          petType: passenger.hasPet ? passenger.petType || null : null,
          petWeightKg: passenger.hasPet && passenger.petWeightKg ? Number(passenger.petWeightKg) : null,
          })),
        }),
      });
      const body = await response.json().catch(() => null) as Booking | { detail?: string | { message?: string; alternatives?: HotelAlternative[] } } | null;
      if (!response.ok) {
        if (body && "detail" in body && typeof body.detail === "object") {
          setAlternatives(body.detail.alternatives ?? []);
          throw new Error(body.detail.message ?? "هتل انتخابی دیگر ظرفیت ندارد.");
        }
        throw new Error(body && "detail" in body && typeof body.detail === "string" ? body.detail : "ثبت درخواست ناموفق بود.");
      }
      setAlternatives([]);
      setNotice("درخواست شما برای بررسی پشتیبان ارسال شد. پس از تأیید مبلغ نهایی، پرداخت در دسترس قرار می‌گیرد.");
      setPassengerDetails([]);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "خطای غیرمنتظره");
    } finally {
      setBusy(false);
    }
  }

  if (items === null) {
    return <p className="py-12 text-center text-muted">در حال دریافت سبد خرید…</p>;
  }

  if (unauthenticated) {
    return (
      <div className="rounded-3xl border border-border bg-white p-8 text-center">
        <h1 className="text-2xl font-black text-brand">برای مشاهده سبد وارد شوید</h1>
        <Link className="mt-5 inline-flex rounded-xl bg-[var(--interaction-hover)] px-5 py-3 font-black text-white" href="/account/?next=/cart/">ورود / ثبت‌نام</Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-3">
            {items.length ? items.map((item) => (
              <article className="flex gap-4 rounded-2xl border border-border bg-white p-4" key={item.id}>
                {item.imageId ? <Image alt="" className="size-20 rounded-xl object-cover" height={80} src={PUBLIC_API_BASE_URL + "/media/" + item.imageId} unoptimized width={80} /> : null}
                <div className="min-w-0 flex-1">
                  <h2 className="font-black text-brand">{item.titleSnapshot}</h2>
                  {item.detailsSnapshot ? <p className="mt-1 text-sm text-muted">{item.detailsSnapshot}</p> : null}
                  <p className="mt-2 text-sm text-muted">{Object.entries(item.roomSelection ?? {}).filter(([, count]) => count > 0).map(([key, count]) => roomSelectionLabel(key, count)).join(" · ")}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                    <span className="rounded-lg bg-surface-muted px-3 py-2">هتل: {money(item.hotelAmount, item.hotelCurrency)}</span>
                    <span className="rounded-lg bg-surface-muted px-3 py-2">بلیط: {money(item.flightAmount, item.flightCurrency)}</span>
                  </div>
                </div>
                <button className="self-start text-sm font-bold text-red-700" onClick={() => void remove(item.id)} type="button">حذف</button>
              </article>
            )) : <div className="rounded-2xl border border-border bg-white p-8 text-center text-muted">سبد خرید شما خالی است.</div>}
          </section>

          <aside className="h-fit rounded-2xl border border-border bg-white p-5">
            <h2 className="text-xl font-black text-brand">خلاصه انتخاب</h2>
            <dl className="mt-4 space-y-2">
              {componentTotals.map(([currency, amount]) => (
                <div className="flex justify-between gap-3" key={currency}>
                  <dt>جمع جزء</dt>
                  <dd className="font-black">{formatCurrency(String(amount), currency)}</dd>
                </div>
              ))}
            </dl>
            {items.length ? (
              <button className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-brand px-4 font-black text-brand hover:bg-brand/5" onClick={() => setPassengerFlowOpen(true)} type="button">
                {passengerDetails.length ? "ویرایش اطلاعات مسافران" : "ورود اطلاعات مسافران"}
              </button>
            ) : null}
            <p className="mt-4 rounded-xl bg-brand-soft p-3 text-xs leading-6 text-brand">مبلغ نهایی پس از بررسی هتل، پرواز و ظرفیت توسط پشتیبان اعلام می‌شود.</p>
            <button className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--interaction-hover)] px-4 font-black text-white disabled:opacity-50" disabled={!items.length || busy} onClick={() => void submitBooking()} type="button">
              {busy ? "در حال ارسال…" : !passengerDetails.length ? "ادامه با ورود اطلاعات مسافر" : "ارسال درخواست برای بررسی پشتیبان"}
            </button>
            {notice ? <p className="mt-3 rounded-xl bg-brand-soft p-3 text-sm" role="status" aria-live="polite" aria-atomic="true">{notice}</p> : null}
            {alternatives.length ? <div className="mt-3 rounded-xl border border-pink-200 bg-pink-50 p-3"><strong className="text-sm text-brand">هتل‌های مشابه دارای ظرفیت</strong><div className="mt-2 grid gap-2">{alternatives.map((hotel) => <Link className="rounded-lg bg-white p-3 text-sm shadow-sm" href={`/tours/${hotel.tourSlug}/#tour-booking`} key={hotel.offerId}><span className="block font-black text-brand">{hotel.hotelName} · {hotel.stars.toLocaleString("fa-IR")} ستاره</span><span className="mt-1 block text-xs text-muted">{hotel.region ?? "همان مقصد"} · {hotel.roomType} · {hotel.serviceType} · {formatCurrency(hotel.price, hotel.currency)}</span></Link>)}</div></div> : null}
          </aside>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-black text-brand">درخواست‌های رزرو و پرداخت</h2>
          <div className="grid gap-3">
            {bookings.map((booking) => {
              const remaining = booking.paymentExpiresAt ? Math.max(0, new Date(booking.paymentExpiresAt).getTime() - now) : null;
              const approved = booking.status === "approved" && booking.totalAmount && (remaining === null || remaining > 0);
              const invoice = booking.status === "approved" || booking.status === "paid";
              const minutes = remaining === null ? 0 : Math.floor(remaining / 60000);
              const seconds = remaining === null ? 0 : Math.floor((remaining % 60000) / 1000);
              return (
                <article className="rounded-2xl border border-border bg-white p-5" key={booking.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="font-black text-brand">{booking.bookingNumber}</h3><p className="mt-1 text-sm font-bold text-muted">{statusLabels[booking.status] ?? booking.status}</p></div>
                    <strong>{booking.totalAmount ? formatCurrency(booking.totalAmount, booking.currency) : "در انتظار اعلام مبلغ نهایی"}</strong>
                  </div>
                  {booking.adminNote ? <p className="mt-3 text-sm text-muted">پاسخ پشتیبان: {booking.adminNote}</p> : null}
                  {booking.status === "approved" && remaining !== null ? <p className={`mt-3 rounded-xl p-3 text-sm font-black ${remaining > 0 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`} role="timer">{remaining > 0 ? `مهلت پرداخت: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : "مهلت پرداخت تمام شده؛ با بازخوانی وضعیت فاکتور باطل می‌شود."}</p> : null}
                  {booking.status === "paid" && booking.tickets.length ? <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black text-emerald-900">بلیت‌های صادرشده ({booking.tickets.length.toLocaleString("fa-IR")})</h4><span className="text-xs font-bold text-emerald-800">پرداخت تأیید شده است</span></div><div className="mt-3 grid gap-3 lg:grid-cols-2">{booking.tickets.map((ticket) => { const ticketUrl = `${PUBLIC_API_BASE_URL}/account/bookings/${booking.id}/tickets/${ticket.id}/pdf`; return <article className="rounded-xl border border-emerald-200 bg-white p-4" key={ticket.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="block text-brand">{ticket.firstName} {ticket.lastName}</strong><span className="mt-1 block text-xs font-bold text-muted" dir="ltr">{ticket.ticketNumber}</span></div><span className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-black text-brand">{ticket.serviceTitle}</span></div><dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2"><div><dt className="font-bold text-brand">مسیر</dt><dd className="mt-1">{ticket.route}</dd></div><div><dt className="font-bold text-brand">تاریخ و ساعت</dt><dd className="mt-1">{ticket.departureDate ?? "اعلام می‌شود"}{ticket.departureTime ? ` · ${ticket.departureTime.slice(0, 5)}` : ""}</dd></div><div><dt className="font-bold text-brand">شرکت حمل‌ونقل</dt><dd className="mt-1">{ticket.carrier ?? "اعلام می‌شود"}</dd></div><div><dt className="font-bold text-brand">کلاس و بار مجاز</dt><dd className="mt-1">{[ticket.travelClass, ticket.baggageAllowance].filter(Boolean).join(" · ") || "اعلام می‌شود"}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2"><a className="rounded-lg border border-brand px-3 py-2 text-xs font-black text-brand" href={ticketUrl} rel="noreferrer" target="_blank">مشاهده و چاپ بلیت</a><a className="rounded-lg bg-brand px-3 py-2 text-xs font-black text-white" href={`${ticketUrl}?download=true`}>ذخیره PDF</a></div></article>; })}</div></section> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {invoice ? <a className="rounded-xl border border-brand px-4 py-2 text-sm font-black text-brand" href={PUBLIC_API_BASE_URL + "/account/bookings/" + booking.id + "/invoice.pdf"}>دانلود فاکتور</a> : null}
                    {approved ? <Link className="rounded-xl bg-[var(--interaction-hover)] px-4 py-2 text-sm font-black text-white" href={"/payment/?contract=" + encodeURIComponent(booking.bookingNumber) + "&amount=" + booking.totalAmount + "&currency=" + booking.currency}>پرداخت در درگاه</Link> : null}
                  </div>
                </article>
              );
            })}
            {!bookings.length ? <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted">هنوز درخواستی ثبت نشده است.</p> : null}
          </div>
        </section>
      </div>

      <PassengerCheckoutModal
        fixedPassengerCounts={fixedTourPassengerCounts}
        onClose={() => setPassengerFlowOpen(false)}
        onComplete={(details) => {
          setPassengerDetails(details);
          setPassengerFlowOpen(false);
          setNotice("اطلاعات مسافران ذخیره شد. برای ارسال درخواست، دکمه ثبت درخواست را بزنید.");
        }}
        open={passengerFlowOpen}
      />
    </>
  );
}
