"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { useOnlineSalesEnabled } from "@/components/online-sales-provider";

type BookingItem = {
  id: number;
  itemType: string;
  titleSnapshot: string;
  detailsSnapshot: string | null;
};
type BookingTicket = {
  id: number;
  ticketNumber: string;
  firstName: string;
  lastName: string;
  serviceTitle: string;
  route: string;
};
type Booking = {
  id: number;
  bookingNumber: string;
  status: string;
  createdAt: string;
  totalAmount: string | null;
  currency: string;
  items: BookingItem[];
  tickets: BookingTicket[];
};
type Lead = {
  id: number;
  subject: string;
  status: string;
  createdAt: string;
  activities: { id: number; body: string; createdAt: string }[];
};
type Cancellation = {
  id: number;
  bookingId: number;
  status: string;
  reason: string;
  resolutionNote: string | null;
  createdAt: string;
};
type Notification = {
  id: number;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const bookingStatusLabels: Record<string, string> = {
  pending_review: "در انتظار بررسی",
  approved: "تأییدشده؛ آماده پرداخت",
  rejected: "رد شده",
  expired: "مهلت پرداخت پایان یافته",
  paid: "پرداخت ثبت شد؛ در انتظار تأیید پشتیبان",
  issued: "پرداخت تأیید و بلیت صادر شد",
  cancelled: "لغو شده",
};
const leadStatusLabels: Record<string, string> = {
  new: "درخواست ثبت شده",
  contacted: "تماس گرفته شد",
  qualified: "در حال بررسی",
  proposal_sent: "پیشنهاد ارسال شد",
  won: "نهایی شده",
  lost: "مختومه",
};
const cancellationStatusLabels: Record<string, string> = {
  requested: "درخواست ثبت شده",
  in_review: "در حال بررسی",
  approved: "تأیید شده",
  rejected: "رد شده",
  completed: "تکمیل شده",
};
const statusToneClasses: Record<string, string> = {
  pending_review: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-sky-200 bg-sky-50 text-sky-800",
  paid: "border-sky-200 bg-sky-50 text-sky-800",
  issued: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-100 text-slate-700",
  expired: "border-rose-200 bg-rose-50 text-rose-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  requested: "border-amber-200 bg-amber-50 text-amber-800",
  in_review: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  new: "border-sky-200 bg-sky-50 text-sky-800",
  contacted: "border-violet-200 bg-violet-50 text-violet-800",
  qualified: "border-amber-200 bg-amber-50 text-amber-800",
  proposal_sent: "border-indigo-200 bg-indigo-50 text-indigo-800",
  won: "border-emerald-200 bg-emerald-50 text-emerald-800",
  lost: "border-slate-200 bg-slate-100 text-slate-700",
};
const itemTypeLabels: Record<string, string> = {
  tour: "تور",
  flight: "پرواز",
  train: "قطار",
  bus: "اتوبوس",
};
const currencyLabels: Record<string, string> = {
  IRT: "تومان",
  IRR: "ریال",
  USD: "دلار",
  EUR: "یورو",
  TRY: "لیر",
};
const removableBookingStatuses = new Set(["paid", "rejected", "expired", "cancelled"]);

function date(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function amount(value: string | null, currency: string) {
  if (!value) return "پس از بررسی کارشناس";
  return `${Number(value).toLocaleString("fa-IR")} ${currencyLabels[currency] ?? currency}`;
}

function statusLabel(status: string, labels: Record<string, string>) {
  return labels[status] ?? "در حال بررسی";
}

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${statusToneClasses[status] ?? "border-border bg-white text-muted"}`}
    >
      {statusLabel(status, labels)}
    </span>
  );
}

export function CustomerOperationsPanel() {
  const onlineSalesEnabled = useOnlineSalesEnabled();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingBookingId, setRemovingBookingId] = useState<number | null>(null);

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(`${PUBLIC_API_BASE_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
      ...options,
    });
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    if (!response.ok) throw new Error(body?.detail ?? "عملیات ناموفق بود.");
    return body;
  }, []);

  const load = useCallback(async () => {
    try {
      const [bookingRows, leadRows, cancellationRows, notificationRows] = await Promise.all([
        request("/account/bookings"),
        request("/account/leads"),
        request("/account/cancellations"),
        request("/account/notifications"),
      ]);
      setBookings(bookingRows as Booking[]);
      setLeads(leadRows as Lead[]);
      setCancellations(cancellationRows as Cancellation[]);
      setNotifications(notificationRows as Notification[]);
    } catch {
      setNotice("برای استفاده از این بخش ابتدا وارد حساب کاربری شوید.");
    }
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await request("/account/leads", {
        method: "POST",
        body: JSON.stringify({
          subject: form.get("subject"),
          details: form.get("details"),
          contactName: form.get("contactName"),
          contactPhone: form.get("contactPhone") || null,
          expectedAmount: form.get("expectedAmount") ? Number(form.get("expectedAmount")) : null,
          currency: "IRT",
        }),
      });
      event.currentTarget.reset();
      setNotice("درخواست قیمت ثبت شد و کارشناس پیگیری می‌کند.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ثبت درخواست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bookingId = Number(form.get("bookingId"));
    setBusy(true);
    try {
      await request(`/account/bookings/${bookingId}/cancellations`, {
        method: "POST",
        body: JSON.stringify({ reason: form.get("reason") }),
      });
      event.currentTarget.reset();
      setNotice("درخواست لغو برای بررسی ارسال شد.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ثبت درخواست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await request("/account/reviews", {
        method: "POST",
        body: JSON.stringify({
          targetType: form.get("targetType"),
          targetId: Number(form.get("targetId")),
          rating: Number(form.get("rating")),
          title: form.get("title") || null,
          body: form.get("body"),
        }),
      });
      event.currentTarget.reset();
      setNotice("نظر شما پس از بررسی منتشر می‌شود.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ثبت نظر ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveBooking(booking: Booking) {
    const confirmed = window.confirm(
      `رزرو ${booking.bookingNumber} از تاریخچهٔ حساب شما حذف شود؟ این کار رزرو، پرداخت یا پروندهٔ پشتیبانی را لغو نمی‌کند.`,
    );
    if (!confirmed) return;

    setRemovingBookingId(booking.id);
    try {
      await request(`/account/bookings/${booking.id}/history`, { method: "DELETE" });
      setBookings((items) => items.filter((item) => item.id !== booking.id));
      setNotice("این سفر از تاریخچهٔ حساب شما حذف شد.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حذف سفر از تاریخچه ناموفق بود.");
    } finally {
      setRemovingBookingId(null);
    }
  }

  async function read(notification: Notification) {
    if (notification.isRead) return;
    try {
      await request(`/account/notifications/${notification.id}/read`, { method: "PATCH" });
      setNotifications((items) =>
        items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      );
    } catch {
      setNotice("به‌روزرسانی اعلان ناموفق بود.");
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_18%_20%,rgba(99,166,255,.28),transparent_22rem),linear-gradient(135deg,#012569,#063b91)] p-6 text-white shadow-[0_20px_46px_rgba(1,37,105,.2)] sm:p-8">
        <p className="text-sm font-bold text-white/70">پیگیری شخصی سفر</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">درخواست‌ها، رزروها و اعلان‌ها</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">
          وضعیت رزرو، پرداخت، بلیت و درخواست‌های خود را در یک نگاه ببینید.
        </p>
      </header>

      {notice ? (
        <p
          aria-atomic="true"
          aria-live="polite"
          className="rounded-2xl border border-brand/15 bg-brand/10 px-4 py-3 text-sm font-bold text-brand"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_16px_38px_rgba(1,37,105,.06)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-sm font-bold text-accent">تاریخچهٔ سفر و خرید</p>
            <h2 className="mt-1 text-2xl font-black text-brand">رزروهای من</h2>
            <p className="mt-1 text-sm text-muted">برای هر رزرو، وضعیت، مبلغ و خدمات انتخاب‌شده مشخص است.</p>
          </div>
          {onlineSalesEnabled ? <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-brand px-4 py-2 text-sm font-black text-brand transition hover:bg-brand hover:text-white"
            href="/cart/"
          >
            سبد و پیگیری کامل
          </Link> : null}
        </div>

        <div className="mt-5 grid gap-4">
          {bookings.map((booking) => {
            const canPay = booking.status === "approved" && Boolean(booking.totalAmount);
            const hasInvoice = booking.status === "approved" || booking.status === "paid";
            const canArchive = removableBookingStatuses.has(booking.status);
            const bookingUrl = `${PUBLIC_API_BASE_URL}/account/bookings/${booking.id}`;

            return (
              <article
                className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-l from-white via-white to-brand-soft/45 p-5 shadow-[0_10px_26px_rgba(1,37,105,.05)]"
                key={booking.id}
              >
                <div className="absolute inset-y-0 right-0 w-1.5 bg-brand" />
                <div className="flex flex-wrap items-start justify-between gap-4 pl-2">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge labels={bookingStatusLabels} status={booking.status === "paid" && booking.tickets.length ? "issued" : booking.status} />
                      <span className="text-xs font-bold text-muted">ثبت در {date(booking.createdAt)}</span>
                    </div>
                    <strong className="block text-lg font-black tracking-wide text-brand" dir="ltr">
                      {booking.bookingNumber}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-brand/10 bg-white/90 px-4 py-3 text-left shadow-sm">
                    <span className="block text-xs font-bold text-muted">مبلغ رزرو</span>
                    <strong className="mt-1 block text-base font-black text-brand">
                      {amount(booking.totalAmount, booking.currency)}
                    </strong>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {booking.items.length ? (
                    booking.items.map((item) => (
                      <div className="rounded-2xl border border-brand/10 bg-white/80 p-3" key={item.id}>
                        <span className="text-xs font-black text-accent">
                          {itemTypeLabels[item.itemType] ?? "خدمت سفر"}
                        </span>
                        <strong className="mt-1 block text-sm font-black text-brand">{item.titleSnapshot}</strong>
                        {item.detailsSnapshot ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.detailsSnapshot}</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border bg-white/70 p-3 text-sm text-muted">
                      جزئیات خدمات این رزرو در حال آماده‌سازی است.
                    </p>
                  )}
                </div>

                {booking.status === "paid" && booking.tickets.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {booking.tickets.map((ticket) => (
                      <a
                        className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100"
                        href={`${bookingUrl}/tickets/${ticket.id}/pdf?download=true`}
                        key={ticket.id}
                      >
                        دانلود بلیت {ticket.firstName} {ticket.lastName} · {ticket.serviceTitle}
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs leading-5 text-muted">
                    {canArchive ? "این مورد را می‌توانید از تاریخچهٔ حساب خود حذف کنید." : "تا نهایی شدن رزرو، این مورد در تاریخچه باقی می‌ماند."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {booking.status === "pending_review" ? (
                      <a className="rounded-xl border border-brand px-3 py-2 text-xs font-black text-brand" href={`${bookingUrl}/proforma.pdf`}>
                        دریافت پیش‌فاکتور
                      </a>
                    ) : null}
                    {hasInvoice ? (
                      <a className="rounded-xl border border-brand px-3 py-2 text-xs font-black text-brand" href={`${bookingUrl}/invoice.pdf`}>
                        دانلود فاکتور
                      </a>
                    ) : null}
                    {canPay ? (
                      <Link
                        className="rounded-xl bg-brand px-3 py-2 text-xs font-black text-white"
                        href={`/payment/?contract=${encodeURIComponent(booking.bookingNumber)}&amount=${booking.totalAmount}&currency=${booking.currency}`}
                      >
                        پرداخت
                      </Link>
                    ) : null}
                    {canArchive ? (
                      <button
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy || removingBookingId === booking.id}
                        onClick={() => void archiveBooking(booking)}
                        type="button"
                      >
                        {removingBookingId === booking.id ? "در حال حذف..." : "حذف از تاریخچه"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}

          {!bookings.length ? (
            <p className="rounded-3xl border border-dashed border-border bg-surface-muted py-10 text-center text-sm font-bold text-muted">
              هنوز رزروی ثبت نشده است.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <form className="rounded-3xl border border-border bg-white p-5" onSubmit={submitLead}>
          <h2 className="text-xl font-black text-brand">درخواست قیمت</h2>
          <div className="mt-4 grid gap-3">
            <input aria-label="موضوع درخواست قیمت" className="min-h-11 rounded-xl border border-border px-3" minLength={3} name="subject" placeholder="مثلاً تور استانبول برای چهار نفر" required />
            <input aria-label="نام و نام خانوادگی" className="min-h-11 rounded-xl border border-border px-3" minLength={2} name="contactName" placeholder="نام و نام خانوادگی" required />
            <input aria-label="شماره تماس" className="min-h-11 rounded-xl border border-border px-3" name="contactPhone" placeholder="شماره تماس" />
            <input aria-label="بودجه تقریبی به تومان" className="min-h-11 rounded-xl border border-border px-3" inputMode="numeric" min="1" name="expectedAmount" placeholder="بودجه تقریبی (تومان)" type="number" />
            <textarea aria-label="تاریخ، مقصد و جزئیات مدنظر" className="min-h-28 rounded-xl border border-border p-3" name="details" placeholder="تاریخ، مقصد و جزئیات مدنظر" />
            <button className="min-h-11 rounded-xl bg-accent px-4 font-black text-brand disabled:opacity-50" disabled={busy}>ثبت درخواست قیمت</button>
          </div>
        </form>

        <form className="rounded-3xl border border-border bg-white p-5" onSubmit={submitCancellation}>
          <h2 className="text-xl font-black text-brand">درخواست لغو رزرو</h2>
          <div className="mt-4 grid gap-3">
            <select aria-label="انتخاب رزرو" className="min-h-11 rounded-xl border border-border px-3" name="bookingId" required>
              <option value="">انتخاب رزرو</option>
              {bookings.filter((item) => item.status !== "rejected").map((item) => (
                <option key={item.id} value={item.id}>
                  {item.bookingNumber} · {statusLabel(item.status, bookingStatusLabels)}
                </option>
              ))}
            </select>
            <textarea aria-label="علت درخواست لغو" className="min-h-28 rounded-xl border border-border p-3" minLength={10} name="reason" placeholder="علت درخواست لغو را بنویسید" required />
            <button className="min-h-11 rounded-xl border border-rose-300 px-4 font-black text-rose-700 disabled:opacity-50" disabled={busy}>ارسال درخواست لغو</button>
          </div>
        </form>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-border bg-white p-5">
          <h2 className="text-xl font-black text-brand">پیگیری درخواست‌های قیمت</h2>
          <div className="mt-4 grid gap-3">
            {leads.map((item) => (
              <article className="rounded-2xl border border-border bg-surface-muted p-4" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <strong className="text-brand">{item.subject}</strong>
                  <StatusBadge labels={leadStatusLabels} status={item.status} />
                </div>
                <p className="mt-2 text-sm text-muted">ثبت در {date(item.createdAt)}</p>
                {item.activities[0] ? <p className="mt-3 text-sm leading-6">آخرین پیگیری: {item.activities[0].body}</p> : null}
              </article>
            ))}
            {!leads.length ? <p className="py-7 text-center text-sm text-muted">درخواستی ثبت نشده است.</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white p-5">
          <h2 className="text-xl font-black text-brand">وضعیت لغوها</h2>
          <div className="mt-4 grid gap-3">
            {cancellations.map((item) => (
              <article className="rounded-2xl border border-border bg-surface-muted p-4" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <strong>رزرو شمارهٔ {item.bookingId.toLocaleString("fa-IR")}</strong>
                  <StatusBadge labels={cancellationStatusLabels} status={item.status} />
                </div>
                <p className="mt-2 text-sm leading-6">علت: {item.reason}</p>
                {item.resolutionNote ? <p className="mt-2 text-sm font-bold text-brand">پاسخ پشتیبانی: {item.resolutionNote}</p> : null}
              </article>
            ))}
            {!cancellations.length ? <p className="py-7 text-center text-sm text-muted">درخواست لغوی ثبت نشده است.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <form className="rounded-3xl border border-border bg-white p-5" onSubmit={submitReview}>
          <h2 className="text-xl font-black text-brand">ثبت نظر و امتیاز</h2>
          <p className="mt-1 text-sm text-muted">شناسه تور یا هتل در آدرس صفحه یا اطلاعات آن قابل مشاهده است.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <select aria-label="نوع مورد ارزیابی" className="min-h-11 rounded-xl border border-border px-3" name="targetType">
                <option value="tour">تور</option>
                <option value="hotel">هتل</option>
              </select>
              <input aria-label="شناسه تور یا هتل" className="min-h-11 rounded-xl border border-border px-3" min="1" name="targetId" placeholder="شناسه" required type="number" />
            </div>
            <select aria-label="امتیاز" className="min-h-11 rounded-xl border border-border px-3" name="rating">
              {[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item} ستاره</option>)}
            </select>
            <input aria-label="عنوان نظر" className="min-h-11 rounded-xl border border-border px-3" name="title" placeholder="عنوان نظر (اختیاری)" />
            <textarea aria-label="متن نظر" className="min-h-28 rounded-xl border border-border p-3" minLength={10} name="body" placeholder="تجربه خود را بنویسید" required />
            <button className="min-h-11 rounded-xl bg-brand px-4 font-black text-white disabled:opacity-50" disabled={busy}>ثبت نظر</button>
          </div>
        </form>

        <div className="rounded-3xl border border-border bg-white p-5">
          <h2 className="text-xl font-black text-brand">اعلان‌های من</h2>
          <div className="mt-4 grid gap-3">
            {notifications.map((item) => (
              <button className={`rounded-2xl p-4 text-right transition ${item.isRead ? "bg-surface-muted" : "bg-brand/10 ring-1 ring-brand/10"}`} key={item.id} onClick={() => void read(item)} type="button">
                <strong className="text-brand">{item.title}</strong>
                <p className="mt-1 text-sm leading-6">{item.body}</p>
                <p className="mt-2 text-xs text-muted">{date(item.createdAt)}</p>
              </button>
            ))}
            {!notifications.length ? <p className="py-7 text-center text-sm text-muted">اعلان جدیدی ندارید.</p> : null}
          </div>
          <Link className="mt-5 inline-flex rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand" href="/account/">بازگشت به حساب کاربری</Link>
        </div>
      </section>
    </div>
  );
}
