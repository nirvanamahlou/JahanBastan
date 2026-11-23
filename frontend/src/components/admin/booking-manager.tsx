"use client";
/*

import { useState } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";

type BookingItem = {
  id: number;
  titleSnapshot: string;
  detailsSnapshot: string | null;
  priceAmount: string | null;
  currency: string | null;
  hotelAmount: string | null;
  hotelCurrency: string | null;
  flightAmount: string | null;
  flightCurrency: string | null;
  roomSelection: Record<string, number>;
};

type BookingPassenger = {
  fullName: string;
  fatherName: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  nationalCode: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  email: string | null;
  phone: string | null;
};
type BookingTicket = {
  id: number;
  ticketNumber: string;
  passengerIndex: number;
  firstName: string;
  lastName: string;
  route: string;
  serviceTitle: string;
  departureDate: string | null;
  departureTime: string | null;
  carrier: string | null;
};
type Booking = {
  id: number;
  bookingNumber: string;
  status: string;
  totalAmount: string | null;
  currency: string;
  customerNote: string | null;
  adminNote: string | null;
  passengerDetails: BookingPassenger[];
  tickets: BookingTicket[];
  customer: { fullName: string; email: string; phone: string | null };
  items: BookingItem[];
};

const statusLabels: Record<string, string> = {
  pending_review: "در انتظار بررسی پشتیبان",
  approved: "تأییدشده و آماده پرداخت",
  rejected: "ردشده",
  paid: "پرداخت‌شده",
};

const roomLabels: Record<string, string> = {
  double: "اتاق دوتخته (هر اتاق ۲ نفر)",
  single: "اتاق یک‌تخته",
  childWithBed: "کودک با تخت",
  childWithoutBed: "کودک بدون تخت",
  infant: "نوزاد",
};

function money(value: string | null, currency: string | null) {
  return value && currency ? formatCurrency(value, currency) : "—";
}

export function BookingManager({ initial }: { initial: Booking[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [quotes, setQuotes] = useState<Record<number, string>>({});

  async function review(booking: Booking, status: "approved" | "rejected") {
    const totalAmount = quotes[booking.id] || booking.totalAmount || "";
    if (status === "approved" && (!totalAmount || Number(totalAmount) <= 0)) {
      window.alert("مبلغ نهایی قابل پرداخت را به تومان وارد کنید.");
      return;
    }
    const adminNote = window.prompt(
      status === "approved" ? "یادداشت تأیید برای مسافر (اختیاری)" : "دلیل رد درخواست",
    ) ?? "";
    setBusy(booking.id);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/admin/bookings/${booking.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote,
          totalAmount: status === "approved" ? totalAmount : null,
          currency: "IRT",
        }),

  async function confirmPayment(booking: Booking) {
    setBusy(booking.id);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/admin/bookings/${booking.id}/confirm-payment`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as Booking | { detail?: string } | null;
      if (!response.ok || !body || !("bookingNumber" in body)) {
        throw new Error(body && "detail" in body && body.detail ? body.detail : "تأیید پرداخت ناموفق بود.");
      }
      setRows((current) => current.map((row) => (row.id === booking.id ? body : row)));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "تأیید پرداخت ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }
      });
      const body = (await response.json().catch(() => null)) as Booking | { detail?: string } | null;
      if (!response.ok || !body || !("bookingNumber" in body)) {
        throw new Error(body && "detail" in body && body.detail ? body.detail : "به‌روزرسانی ناموفق بود.");
      }
      setRows((current) => current.map((row) => (row.id === booking.id ? body : row)));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "به‌روزرسانی ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      {rows.map((booking) => (
        <article className="rounded-2xl border border-border bg-white p-5 shadow-sm" key={booking.id}>
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="font-black text-brand">{booking.bookingNumber} · {booking.customer.fullName}</h2>
              <p className="mt-1 text-sm text-muted" dir="ltr">{booking.customer.email}{booking.customer.phone ? ` · ${booking.customer.phone}` : ""}</p>
            </div>
            <div className="text-left">
              <strong>{booking.totalAmount ? money(booking.totalAmount, booking.currency) : "در انتظار قیمت نهایی"}</strong>
              <p className="text-sm font-bold text-muted">{statusLabels[booking.status] ?? booking.status}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead><tr className="bg-surface-muted"><th className="p-3 text-right">انتخاب مسافر</th><th className="p-3 text-right">اتاق‌ها</th><th className="p-3 text-right">هتل</th><th className="p-3 text-right">پرواز</th></tr></thead>
              <tbody>{booking.items.map((item) => (
                <tr className="border-t border-border" key={item.id}>
                  <td className="p-3"><strong>{item.titleSnapshot}</strong><p className="mt-1 text-muted">{item.detailsSnapshot ?? "—"}</p></td>
                  <td className="p-3 text-muted">{Object.entries(item.roomSelection ?? {}).filter(([, count]) => count > 0).map(([key, count]) => `${roomLabels[key] ?? key}: ${count}`).join(" · ") || "—"}</td>
                  <td className="p-3 font-bold">{money(item.hotelAmount, item.hotelCurrency)}</td>
                  <td className="p-3 font-bold">{money(item.flightAmount, item.flightCurrency)}</td>
          {booking.tickets?.length ? <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"><h3 className="font-black text-emerald-900">بلیت‌های صادرشده ({booking.tickets.length.toLocaleString("fa-IR")})</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{booking.tickets.map((ticket) => <article className="rounded-xl border border-emerald-200 bg-white p-3 text-sm" key={ticket.id}><strong className="block text-brand">{ticket.firstName} {ticket.lastName}</strong><span className="mt-1 block text-xs font-bold text-muted" dir="ltr">{ticket.ticketNumber}</span><p className="mt-2 text-xs text-muted">{ticket.serviceTitle} · {ticket.route}</p><p className="mt-1 text-xs text-muted">{ticket.departureDate ?? "تاریخ اعلام می‌شود"}{ticket.departureTime ? ` · ${ticket.departureTime.slice(0, 5)}` : ""} · {ticket.carrier ?? "حمل‌ونقل اعلام می‌شود"}</p></article>)}</div></section> : null}
                </tr>
              ))}</tbody>
            </table>
          </div>

          {booking.customerNote ? <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm">یادداشت مسافر: {booking.customerNote}</p> : null}
          {booking.passengerDetails?.length ? (<section className="mt-4 rounded-2xl border border-brand/15 bg-brand/5 p-4"><h3 className="font-black text-brand">اطلاعات مسافران ({booking.passengerDetails.length.toLocaleString("fa-IR")} نفر)</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{booking.passengerDetails.map((passenger, index) => <article className="rounded-xl border border-border bg-white p-3 text-sm" key={index}><p className="font-black text-brand">{index + 1}. {passenger.fullName}</p>{passenger.firstNameEn || passenger.lastNameEn ? <p className="mt-1 text-muted" dir="ltr">{[passenger.firstNameEn, passenger.lastNameEn].filter(Boolean).join(" ")}</p> : null}<dl className="mt-2 grid gap-1 text-xs text-muted"><div><dt className="inline">کد ملی: </dt><dd className="inline font-bold text-brand">{passenger.nationalCode || "ثبت نشده"}</dd></div><div><dt className="inline">گذرنامه: </dt><dd className="inline font-bold text-brand" dir="ltr">{passenger.passportNumber || "ثبت نشده"}</dd></div><div><dt className="inline">انقضای گذرنامه: </dt><dd className="inline font-bold text-brand">{passenger.passportExpiryDate || "ثبت نشده"}</dd></div></dl></article>)}</div></section>) : null}          {booking.adminNote ? <p className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">یادداشت مدیریت: {booking.adminNote}</p> : null}
          {booking.status === "pending_review" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(15rem,22rem)_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-bold">مبلغ نهایی قابل پرداخت (تومان)
                <input className="min-h-11 rounded-xl border border-border px-3" inputMode="numeric" min="1" onChange={(event) => setQuotes((current) => ({ ...current, [booking.id]: event.target.value }))} placeholder="مثلاً ۸۵٬۰۰۰٬۰۰۰" type="number" value={quotes[booking.id] ?? booking.totalAmount ?? ""} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50" disabled={busy === booking.id} onClick={() => void review(booking, "approved")} type="button">تأیید و فعال‌سازی پرداخت</button>
                <button className="rounded-xl border border-red-300 px-5 py-3 font-black text-red-700 disabled:opacity-50" disabled={busy === booking.id} onClick={() => void review(booking, "rejected")} type="button">رد درخواست</button>
              </div>
            </div>
          {booking.status === "approved" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div><h3 className="font-black text-emerald-900">تأیید تسویه و صدور بلیت</h3><p className="mt-1 text-sm text-emerald-800">پس از اطمینان از پرداخت، بلیت یکتا برای هر مسافر صادر می‌شود.</p></div><button className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50" disabled={busy === booking.id} onClick={() => void confirmPayment(booking)} type="button">تأیید پرداخت و صدور بلیت</button></div> : null}
          ) : null}
        </article>
      ))}
      {!rows.length ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">درخواستی ثبت نشده است.</p> : null}
    </div>
  );
}*/
export { BookingManager } from "./booking-manager-impl";
