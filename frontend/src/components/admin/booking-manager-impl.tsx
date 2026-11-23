"use client";

import { useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDateTime } from "@/lib/persian-date";

type BookingItem = { id: number; titleSnapshot: string; detailsSnapshot: string | null; priceAmount: string | null; currency: string | null; hotelAmount: string | null; hotelCurrency: string | null; flightAmount: string | null; flightCurrency: string | null; roomSelection: Record<string, number>; };
type BookingPassenger = { fullName: string; fatherName: string | null; firstNameEn: string | null; lastNameEn: string | null; nationalCode: string | null; passportNumber: string | null; passportExpiryDate: string | null; hasPet: boolean; petName: string | null; petType: string | null; petWeightKg: string | null; };
type BookingTicket = { id: number; ticketNumber: string; firstName: string; lastName: string; serviceTitle: string; route: string; departureDate: string | null; departureTime: string | null; carrier: string | null; };
type Booking = { id: number; bookingNumber: string; status: string; totalAmount: string | null; currency: string; customerNote: string | null; adminNote: string | null; passengerDetails: BookingPassenger[]; tickets: BookingTicket[]; customer: { fullName: string; email: string; phone: string | null }; items: BookingItem[]; createdAt: string; updatedAt: string; reviewedAt: string | null; };

const statusLabels: Record<string, string> = { pending_review: "در انتظار بررسی پشتیبان", approved: "تأییدشده و آماده پرداخت", rejected: "ردشده", expired: "منقضی‌شده", paid: "پرداخت تأیید شده و بلیت صادر شده" };
const roomLabels: Record<string, string> = { double: "اتاق دوتخته", single: "اتاق یک‌تخته", childWithBed: "کودک با تخت", childWithoutBed: "کودک بدون تخت", infant: "نوزاد" };

function money(value: string | null, currency: string | null) { return value && currency ? formatCurrency(value, currency) : "—"; }
function bookingStatusLabel(booking: Booking) { if (booking.status === "paid") return booking.tickets.length ? "پرداخت تأیید شد و بلیت صادر شده" : "پرداخت ثبت شده؛ در انتظار تأیید پشتیبان"; return statusLabels[booking.status] ?? booking.status; }
function errorText(body: Booking | { detail?: string } | null, fallback: string) { return body && "detail" in body && body.detail ? body.detail : fallback; }

export function BookingManager({ initial }: { initial: Booking[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [quotes, setQuotes] = useState<Record<number, string>>({});

  async function review(booking: Booking, nextStatus: "approved" | "rejected") {
    if (nextStatus === "rejected" && !window.confirm("این درخواست و بلیت‌های صادرشده حذف می‌شوند. ادامه می‌دهید؟")) return;
    const totalAmount = quotes[booking.id] || booking.totalAmount || "";
    if (nextStatus === "approved" && (!totalAmount || Number(totalAmount) <= 0)) { window.alert("مبلغ نهایی قابل پرداخت را به تومان وارد کنید."); return; }
    const adminNote = window.prompt(nextStatus === "approved" ? "یادداشت تأیید برای مسافر (اختیاری)" : "دلیل رد درخواست") ?? "";
    setBusy(booking.id);
    try {
      const response = await adminClientFetch(`/admin/bookings/${booking.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, adminNote, totalAmount: nextStatus === "approved" ? totalAmount : null, currency: "IRT" }) });
      const body = (await response.json().catch(() => null)) as Booking | { detail?: string } | null;
      if (!response.ok || !body || !("bookingNumber" in body)) throw new Error(errorText(body, "به‌روزرسانی ناموفق بود."));
      if (nextStatus === "rejected") {
        setRows((current) => current.filter((row) => row.id !== booking.id));
        setQuotes((current) => {
          const next = { ...current };
          delete next[booking.id];
          return next;
        });
        return;
      }
      setRows((current) => current.map((row) => (row.id === booking.id ? body : row)));
    } catch (error) { window.alert(error instanceof Error ? error.message : "به‌روزرسانی ناموفق بود."); } finally { setBusy(null); }
  }

  async function confirmPayment(booking: Booking) {
    setBusy(booking.id);
    try {
      const response = await adminClientFetch(`/admin/bookings/${booking.id}/confirm-payment`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const body = (await response.json().catch(() => null)) as Booking | { detail?: string } | null;
      if (!response.ok || !body || !("bookingNumber" in body)) throw new Error(errorText(body, "تأیید پرداخت ناموفق بود."));
      setRows((current) => current.map((row) => (row.id === booking.id ? body : row)));
    } catch (error) { window.alert(error instanceof Error ? error.message : "تأیید پرداخت ناموفق بود."); } finally { setBusy(null); }
  }

  async function deleteExpired(booking: Booking) {
    if (!window.confirm(`رزرو منقضی‌شده ${booking.bookingNumber} به‌طور دائمی حذف شود؟`)) return;
    setBusy(booking.id);
    try {
      const response = await adminClientFetch(`/admin/bookings/${booking.id}`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" } });
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      if (!response.ok) throw new Error(errorText(body, "حذف رزرو ناموفق بود."));
      setRows((current) => current.filter((row) => row.id !== booking.id));
    } catch (error) { window.alert(error instanceof Error ? error.message : "حذف رزرو ناموفق بود."); } finally { setBusy(null); }
  }
  return <div className="grid gap-4">{rows.map((booking) => <article className="rounded-2xl border border-border bg-white p-5 shadow-sm" key={booking.id}><header className="flex flex-wrap justify-between gap-4"><div><h2 className="font-black text-brand">{booking.bookingNumber} · {booking.customer.fullName}</h2><p className="mt-1 text-sm text-muted" dir="ltr">{booking.customer.email}{booking.customer.phone ? ` · ${booking.customer.phone}` : ""}</p><time className="mt-2 block text-xs font-bold text-muted">ثبت درخواست: {formatPersianDateTime(booking.createdAt)}</time>{booking.reviewedAt ? <time className="mt-1 block text-xs text-muted">آخرین بررسی: {formatPersianDateTime(booking.reviewedAt)}</time> : null}</div><div className="text-left"><strong>{booking.totalAmount ? money(booking.totalAmount, booking.currency) : "در انتظار قیمت نهایی"}</strong><p className="text-sm font-bold text-muted">{bookingStatusLabel(booking)}</p></div></header><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[52rem] text-sm"><thead><tr className="bg-surface-muted"><th className="p-3 text-right">انتخاب مسافر</th><th className="p-3 text-right">اتاق‌ها</th><th className="p-3 text-right">هتل</th><th className="p-3 text-right">پرواز</th></tr></thead><tbody>{booking.items.map((item) => <tr className="border-t border-border" key={item.id}><td className="p-3"><strong>{item.titleSnapshot}</strong><p className="mt-1 text-muted">{item.detailsSnapshot ?? "—"}</p></td><td className="p-3 text-muted">{Object.entries(item.roomSelection ?? {}).filter(([, count]) => count > 0).map(([key, count]) => `${roomLabels[key] ?? key}: ${count}`).join(" · ") || "—"}</td><td className="p-3 font-bold">{money(item.hotelAmount, item.hotelCurrency)}</td><td className="p-3 font-bold">{money(item.flightAmount, item.flightCurrency)}</td></tr>)}</tbody></table></div>{booking.customerNote ? <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm">یادداشت مسافر: {booking.customerNote}</p> : null}{booking.passengerDetails.length ? <section className="mt-4 rounded-2xl border border-brand/15 bg-brand/5 p-4"><h3 className="font-black text-brand">اطلاعات مسافران ({booking.passengerDetails.length.toLocaleString("fa-IR")} نفر)</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{booking.passengerDetails.map((passenger, index) => <article className="rounded-xl border border-border bg-white p-3 text-sm" key={index}><p className="font-black text-brand">{index + 1}. {passenger.fullName}</p>{passenger.firstNameEn || passenger.lastNameEn ? <p className="mt-1 text-muted" dir="ltr">{[passenger.firstNameEn, passenger.lastNameEn].filter(Boolean).join(" ")}</p> : null}<dl className="mt-2 grid gap-1 text-xs text-muted"><div>نام پدر: <strong className="text-brand">{passenger.fatherName || "ثبت نشده"}</strong></div><div>کد ملی: <strong className="text-brand">{passenger.nationalCode || "ثبت نشده"}</strong></div><div>گذرنامه: <strong className="text-brand" dir="ltr">{passenger.passportNumber || "ثبت نشده"}</strong></div>{passenger.hasPet ? <div>حیوان خانگی: <strong className="text-brand">{[passenger.petName, passenger.petType, passenger.petWeightKg ? `${passenger.petWeightKg} کیلوگرم` : null].filter(Boolean).join(" · ")}</strong></div> : null}</dl></article>)}</div></section> : null}{booking.tickets.length ? <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"><h3 className="font-black text-emerald-900">بلیت‌های صادرشده ({booking.tickets.length.toLocaleString("fa-IR")})</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{booking.tickets.map((ticket) => <article className="rounded-xl border border-emerald-200 bg-white p-3 text-sm" key={ticket.id}><strong className="block text-brand">{ticket.firstName} {ticket.lastName}</strong><span className="mt-1 block text-xs font-bold text-muted" dir="ltr">{ticket.ticketNumber}</span><p className="mt-2 text-xs text-muted">{ticket.serviceTitle} · {ticket.route}</p><p className="mt-1 text-xs text-muted">{ticket.departureDate ?? "تاریخ اعلام می‌شود"}{ticket.departureTime ? ` · ${ticket.departureTime.slice(0, 5)}` : ""} · {ticket.carrier ?? "حمل‌ونقل اعلام می‌شود"}</p></article>)}</div></section> : null}{booking.adminNote ? <p className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">یادداشت مدیریت: {booking.adminNote}</p> : null}{booking.status === "pending_review" ? <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(15rem,22rem)_auto] sm:items-end"><label className="grid gap-1 text-sm font-bold">مبلغ نهایی قابل پرداخت (تومان)<input className="min-h-11 rounded-xl border border-border px-3" inputMode="numeric" min="1" onChange={(event) => setQuotes((current) => ({ ...current, [booking.id]: event.target.value }))} placeholder="مثلاً ۸۵٬۰۰۰٬۰۰۰" type="number" value={quotes[booking.id] ?? booking.totalAmount ?? ""} /></label><div className="flex flex-wrap gap-2"><button className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50" disabled={busy === booking.id} onClick={() => void review(booking, "approved")} type="button">تأیید و فعال‌سازی پرداخت</button><button className="rounded-xl border border-red-300 px-5 py-3 font-black text-red-700 disabled:opacity-50" disabled={busy === booking.id} onClick={() => void review(booking, "rejected")} type="button">رد درخواست</button></div></div> : null}{booking.status === "approved" ? <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4"><h3 className="font-black text-sky-900">در انتظار پرداخت مشتری</h3><p className="mt-1 text-sm text-sky-800">پس از تأیید درگاه، این رزرو برای تأیید نهایی و صدور بلیت در همین صفحه نمایش داده می‌شود.</p></div> : null}{booking.status === "paid" && !booking.tickets.length ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div><h3 className="font-black text-emerald-900">پرداخت درگاه ثبت شده است</h3><p className="mt-1 text-sm text-emerald-800">پس از بررسی پشتیبان، بلیت یکتا برای هر مسافر صادر می‌شود.</p></div><button className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50" disabled={busy === booking.id} onClick={() => void confirmPayment(booking)} type="button">تأیید پرداخت و صدور بلیت</button></div> : null}{["approved", "paid"].includes(booking.status) ? <div className="mt-3 flex justify-end"><button className="rounded-xl border border-red-300 px-5 py-3 font-black text-red-700 disabled:opacity-50" disabled={busy === booking.id} onClick={() => void review(booking, "rejected")} type="button">رد درخواست و حذف بلیت‌ها</button></div> : null}{booking.status === "expired" ? <div className="mt-3 flex justify-end"><button className="rounded-xl border border-red-300 px-5 py-3 font-black text-red-700 disabled:opacity-50" disabled={busy === booking.id} onClick={() => void deleteExpired(booking)} type="button">حذف دائمی رزرو منقضی</button></div> : null}</article>)}{!rows.length ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">درخواستی ثبت نشده است.</p> : null}</div>;
}
