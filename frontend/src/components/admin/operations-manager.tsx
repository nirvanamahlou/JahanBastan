"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";
import { formatPersianDateTime } from "@/lib/persian-date";

type PopularTour = { title: string; bookings: number };
type Dashboard = {
  bookingsTotal: number;
  bookingsPending: number;
  bookingsPaid: number;
  bookingsCancelled: number;
  paymentsPending: number;
  confirmedRevenue: string;
  refundTotal: string;
  customersTotal: number;
  customersActive30Days: number;
  leadsOpen: number;
  cancellationOpen: number;
  supportOpen: number;
  reviewsPending: number;
  newsletterActive: number;
  popularTours: PopularTour[];
};
type Lead = { id: number; subject: string; contactName: string; contactPhone: string | null; status: string; details: string | null; createdAt: string };
type Cancellation = { id: number; bookingId: number; reason: string; status: string; refundAmount: string | null; refundStatus: string; refundReference: string | null; refundedAt: string | null; resolutionNote: string | null; createdAt: string };
type Review = { id: number; targetType: string; targetId: number | null; pagePath: string | null; pageTitle: string | null; authorNameSnapshot: string; rating: number; title: string | null; body: string; status: string; createdAt: string };
type Discount = { id: number; code: string; title: string; discountType: string; amount: string; usedCount: number; maxUses: number | null; isActive: boolean };
type Subscriber = { id: number; email: string; fullName: string | null; phone: string | null; isActive: boolean; createdAt: string };

type DashboardNumber = "bookingsTotal" | "bookingsPending" | "bookingsPaid" | "bookingsCancelled" | "paymentsPending" | "customersTotal" | "customersActive30Days" | "leadsOpen" | "cancellationOpen" | "supportOpen" | "reviewsPending" | "newsletterActive";
const stats: Array<[DashboardNumber, string, string]> = [
  ["bookingsTotal", "کل رزروها", "bg-brand/10 text-brand"],
  ["bookingsPending", "در انتظار بررسی", "bg-amber-100 text-amber-800"],
  ["bookingsPaid", "پرداخت‌شده", "bg-emerald-100 text-emerald-800"],
  ["bookingsCancelled", "لغوشده", "bg-rose-100 text-rose-800"],
  ["paymentsPending", "پرداخت‌های در انتظار", "bg-orange-100 text-orange-800"],
  ["customersTotal", "مشتریان", "bg-sky-100 text-sky-800"],
  ["customersActive30Days", "مشتری فعال ۳۰ روز", "bg-teal-100 text-teal-800"],
  ["leadsOpen", "لیدهای باز", "bg-violet-100 text-violet-800"],
  ["cancellationOpen", "لغوهای باز", "bg-rose-100 text-rose-800"],
  ["supportOpen", "پشتیبانی باز", "bg-cyan-100 text-cyan-800"],
  ["reviewsPending", "نظرهای منتظر", "bg-fuchsia-100 text-fuchsia-800"],
  ["newsletterActive", "اعضای خبرنامه", "bg-lime-100 text-lime-800"],
];

function date(value: string) {
  return formatPersianDateTime(value);
}
function toman(value: string | null | undefined) {
  return `${Number(value || 0).toLocaleString("fa-IR")} تومان`;
}

export function OperationsManager() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await adminClientFetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
      ...options,
    });
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    if (!response.ok) throw new Error(body?.detail ?? "عملیات ناموفق بود.");
    return body;
  }, []);

  const load = useCallback(async () => {
    try {
      const [summary, leadRows, cancellationRows, reviewRows, discountRows, subscriberRows] = await Promise.all([
        request("/admin/operations/dashboard"),
        request("/admin/leads"),
        request("/admin/cancellations"),
        request("/admin/reviews"),
        request("/admin/discount-codes"),
        request("/admin/newsletter/subscribers"),
      ]);
      setDashboard(summary as Dashboard);
      setLeads(leadRows as Lead[]);
      setCancellations(cancellationRows as Cancellation[]);
      setReviews(reviewRows as Review[]);
      setDiscounts(discountRows as Discount[]);
      setSubscribers(subscriberRows as Subscriber[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "دریافت اطلاعات ناموفق بود.");
    }
  }, [request]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize initial API state.
  useEffect(() => { void load(); }, [load]);

  async function update(path: string, body: object) {
    setBusy(true);
    setNotice("");
    try {
      await request(path, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ذخیره انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function completeCancellation(item: Cancellation) {
    const amount = window.prompt(
      "مبلغ بازپرداخت به تومان را وارد کنید. برای لغو بدون بازپرداخت، ۰ وارد کنید.",
      item.refundAmount ?? "0",
    );
    if (amount === null) return;
    const refundAmount = Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount < 0 || !Number.isInteger(refundAmount)) {
      setNotice("مبلغ بازپرداخت باید یک عدد صحیحِ صفر یا بزرگ‌تر باشد.");
      return;
    }
    await update(`/admin/cancellations/${item.id}`, {
      status: "completed",
      refundAmount,
      resolutionNote: "لغو و بازپرداخت توسط کارشناس ثبت شد.",
    });
  }

  async function createDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice("");
    try {
      await request("/admin/discount-codes", {
        method: "POST",
        body: JSON.stringify({
          code: form.get("code"),
          title: form.get("title"),
          discountType: form.get("discountType"),
          amount: Number(form.get("amount")),
          maxUses: form.get("maxUses") ? Number(form.get("maxUses")) : null,
        }),
      });
      event.currentTarget.reset();
      await load();
      setNotice("کد تخفیف ایجاد شد.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ثبت کد ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8" dir="rtl">
      {notice ? <p role="status" aria-live="polite" className="rounded-xl bg-brand/10 px-4 py-3 text-sm font-bold text-brand">{notice}</p> : null}
      <section className="rounded-3xl bg-brand p-6 text-white sm:p-8">
        <p className="text-sm text-white/70">مرکز عملیات داخلی</p>
        <h1 className="mt-2 text-3xl font-black">فروش، پیگیری و وفاداری مشتری</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">لیدها، پرداخت‌ها، لغوها، کدهای تخفیف، نظرها و خبرنامه در یک گردش داخلی و قابل پیگیری مدیریت می‌شوند.</p>
        {dashboard ? <strong className="mt-5 block text-xl text-accent">فروش تأییدشده: {toman(dashboard.confirmedRevenue)} · بازپرداخت ثبت‌شده: {toman(dashboard.refundTotal)}</strong> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(([key, label, style]) => <article key={key} className={`rounded-2xl p-5 ${style}`}><p className="text-sm font-bold">{label}</p><strong className="mt-2 block text-3xl font-black">{dashboard ? dashboard[key].toLocaleString("fa-IR") : "—"}</strong></article>)}
      </section>

      {dashboard ? <section className="rounded-3xl border border-border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black text-brand">تورهای پرتقاضا</h2><p className="mt-1 text-sm text-muted">بر پایهٔ تعداد آیتم‌های رزرو ثبت‌شده</p></div><span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand">۵ مورد برتر</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{dashboard.popularTours.map((tour, index) => <article className="rounded-2xl bg-surface-muted p-4" key={tour.title}><span className="text-sm font-black text-accent">#{(index + 1).toLocaleString("fa-IR")}</span><strong className="mt-2 block line-clamp-2 text-brand">{tour.title}</strong><p className="mt-3 text-sm text-muted">{tour.bookings.toLocaleString("fa-IR")} درخواست</p></article>)}{!dashboard.popularTours.length ? <p className="py-4 text-sm text-muted">هنوز دادهٔ کافی برای نمایش تورهای پرتقاضا وجود ندارد.</p> : null}</div></section> : null}

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-border bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-brand">لیدها و درخواست‌های قیمت</h2><span className="text-sm text-muted">{leads.length.toLocaleString("fa-IR")} مورد</span></div><div className="mt-4 grid gap-3">{leads.slice(0, 10).map((lead) => <article className="rounded-2xl bg-surface-muted p-4" key={lead.id}><div className="flex flex-wrap justify-between gap-2"><div><strong className="text-brand">{lead.subject}</strong><p className="mt-1 text-sm text-muted">{lead.contactName}{lead.contactPhone ? ` · ${lead.contactPhone}` : ""}</p></div><span className="rounded-lg bg-white px-2 py-1 text-xs font-bold">{lead.status}</span></div>{lead.details ? <p className="mt-2 text-sm">{lead.details}</p> : null}<div className="mt-3 flex flex-wrap gap-2"><select aria-label="وضعیت لید" className="rounded-lg border border-border bg-white px-2 py-2 text-sm" defaultValue={lead.status} disabled={busy} onChange={(event) => void update(`/admin/leads/${lead.id}`, { status: event.target.value, activityNote: "به‌روزرسانی از مرکز عملیات" })}>{["new", "contacted", "qualified", "proposal_sent", "won", "lost"].map((item) => <option key={item}>{item}</option>)}</select><small className="self-center text-muted">{date(lead.createdAt)}</small></div></article>)}{!leads.length ? <p className="py-7 text-center text-sm text-muted">هنوز درخواستی ثبت نشده است.</p> : null}</div></div>
        <form className="rounded-3xl border border-border bg-white p-5" onSubmit={createDiscount}><h2 className="text-xl font-black text-brand">کد تخفیف جدید</h2><div className="mt-4 grid gap-3"><input required aria-label="کد تخفیف" name="code" placeholder="SUMMER1405" className="min-h-11 rounded-xl border border-border px-3 uppercase" /><input required aria-label="عنوان کمپین تخفیف" name="title" placeholder="عنوان کمپین" className="min-h-11 rounded-xl border border-border px-3" /><div className="grid grid-cols-2 gap-3"><select aria-label="نوع تخفیف" name="discountType" className="min-h-11 rounded-xl border border-border px-3"><option value="fixed">مبلغ ثابت</option><option value="percentage">درصدی</option></select><input required min="1" aria-label="مقدار تخفیف" name="amount" type="number" inputMode="numeric" placeholder="مقدار" className="min-h-11 rounded-xl border border-border px-3" /></div><input min="1" aria-label="سقف استفاده از کد تخفیف" name="maxUses" type="number" inputMode="numeric" placeholder="سقف استفاده (اختیاری)" className="min-h-11 rounded-xl border border-border px-3" /><button disabled={busy} className="min-h-11 rounded-xl bg-accent px-4 font-black text-brand disabled:opacity-50">ایجاد کد تخفیف</button></div></form>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-border bg-white p-5"><h2 className="text-xl font-black text-brand">درخواست‌های لغو و بازپرداخت</h2><div className="mt-4 grid gap-3">{cancellations.slice(0, 10).map((item) => <article className="rounded-2xl border border-border p-4" key={item.id}><div className="flex justify-between gap-3"><strong>رزرو #{item.bookingId.toLocaleString("fa-IR")}</strong><span className="text-sm font-bold text-muted">{item.status}</span></div><p className="mt-2 text-sm leading-6">{item.reason}</p><time className="mt-2 block text-xs font-bold text-muted">زمان ثبت درخواست: {date(item.createdAt)}</time>{item.refundStatus === "recorded" ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">بازپرداخت {toman(item.refundAmount)} · کد پیگیری {item.refundReference ?? "—"}</p> : null}<div className="mt-3 flex flex-wrap gap-2">{["requested", "in_review"].includes(item.status) ? <><button disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white" onClick={() => void update(`/admin/cancellations/${item.id}`, { status: "approved", resolutionNote: "درخواست لغو تأیید شد." })} type="button">تأیید</button><button disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700" onClick={() => void update(`/admin/cancellations/${item.id}`, { status: "rejected", resolutionNote: "درخواست لغو تأیید نشد." })} type="button">رد</button></> : null}{item.status === "approved" ? <button disabled={busy} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white" onClick={() => void completeCancellation(item)} type="button">ثبت لغو و بازپرداخت</button> : null}</div></article>)}{!cancellations.length ? <p className="py-7 text-center text-sm text-muted">درخواست لغوی وجود ندارد.</p> : null}</div></div>
        <div className="rounded-3xl border border-border bg-white p-5"><h2 className="text-xl font-black text-brand">نظرهای کاربران</h2><div className="mt-4 grid max-h-[48rem] gap-3 overflow-y-auto pl-1">{reviews.map((item) => <article className="rounded-2xl border border-border p-4" key={item.id}><div className="flex justify-between gap-3"><div><strong>{"★".repeat(item.rating)} <span className="text-sm text-muted">{item.authorNameSnapshot}</span></strong><p className="mt-1 text-xs font-bold text-muted">{item.targetType === "page" ? (item.pageTitle ?? item.pagePath ?? "صفحه سایت") : `${item.targetType} #${item.targetId}`}</p></div><span className="text-sm font-bold text-muted">{item.status}</span></div>{item.pagePath ? <a className="mt-2 inline-block text-xs font-black text-brand underline" href={item.pagePath} rel="noreferrer" target="_blank">مشاهده صفحه</a> : null}<p className="mt-2 text-sm">{item.title ? `${item.title} — ` : ""}{item.body}</p><time className="mt-2 block text-xs font-bold text-muted">زمان ثبت نظر: {date(item.createdAt)}</time>{item.status === "pending" ? <div className="mt-3 flex gap-2"><button disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white" onClick={() => void update(`/admin/reviews/${item.id}`, { status: "approved" })} type="button">انتشار</button><button disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700" onClick={() => void update(`/admin/reviews/${item.id}`, { status: "rejected" })} type="button">رد</button></div> : null}</article>)}{!reviews.length ? <p className="py-7 text-center text-sm text-muted">هنوز نظری ثبت نشده است.</p> : null}</div></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-border bg-white p-5"><h2 className="text-xl font-black text-brand">کدهای تخفیف</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[34rem] text-sm"><caption className="sr-only">فهرست کدهای تخفیف</caption><thead className="bg-surface-muted text-right"><tr><th className="p-3">کد</th><th className="p-3">مقدار</th><th className="p-3">استفاده</th><th className="p-3">وضعیت</th></tr></thead><tbody>{discounts.map((item) => <tr className="border-b border-border" key={item.id}><td className="p-3 font-black text-brand">{item.code}<span className="mt-1 block text-xs font-normal text-muted">{item.title}</span></td><td className="p-3">{item.discountType === "percentage" ? `${item.amount}%` : toman(item.amount)}</td><td className="p-3">{item.usedCount.toLocaleString("fa-IR")}{item.maxUses ? ` / ${item.maxUses.toLocaleString("fa-IR")}` : ""}</td><td className="p-3"><button className="rounded-lg border border-border px-2 py-1 font-bold" disabled={busy} onClick={() => void update(`/admin/discount-codes/${item.id}`, { isActive: !item.isActive })} type="button">{item.isActive ? "فعال" : "غیرفعال"}</button></td></tr>)}</tbody></table></div></div>
        <div className="rounded-3xl border border-border bg-white p-5"><h2 className="text-xl font-black text-brand">فهرست خبرنامه</h2><p className="mt-1 text-sm text-muted">ارسال پیام پس از اتصال SMTP یا پنل پیامک فعال می‌شود.</p><div className="mt-4 grid gap-2">{subscribers.slice(0, 10).map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-surface-muted p-3 text-sm"><div><strong>{item.fullName ?? "بدون نام"}</strong><span className="mr-2 text-muted" dir="ltr">{item.email}</span></div><span className="text-muted">{date(item.createdAt)}</span></div>)}{!subscribers.length ? <p className="py-7 text-center text-sm text-muted">عضوی ثبت نشده است.</p> : null}</div></div>
      </section>
    </div>
  );
}
