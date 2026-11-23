"use client";

import { FormEvent, useState } from "react";

import {
  CalendarIcon,
  ClipboardIcon,
  CreditCardIcon,
  MailIcon,
  PhoneIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/layout/site-icons";
import { adminClientFetch } from "@/lib/admin-client";

type Customer = {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type CustomerListResponse = {
  items: Customer[];
  total: number;
  limit: number;
  offset: number;
};

type CustomerFile = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  emergencyPhone: string | null;
  nationalCode: string | null;
  birthDate: string | null;
  address: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  walletCredit: string | number;
  walletCurrency: string;
  supportRequestCount: number;
  passengers: Array<{
    id: number;
    fullName: string;
    firstNameEn: string | null;
    lastNameEn: string | null;
    fatherName: string | null;
    nationalCode: string | null;
    passportNumber: string | null;
    passportExpiryDate: string | null;
    birthDate: string | null;
    gender: string;
    phone: string | null;
    email: string | null;
    isDefault: boolean;
  }>;
  bookings: Array<{
    id: number;
    bookingNumber: string;
    status: string;
    serviceTitles: string[];
    totalAmount: string | number | null;
    currency: string;
    paymentMethod: string;
    passengerCount: number;
    ticketCount: number;
    documentCount: number;
    createdAt: string;
    paymentExpiresAt: string | null;
  }>;
  tickets: Array<{
    ticketNumber: string;
    passengerName: string;
    itemType: string;
    serviceTitle: string;
    route: string;
    departureDate: string | null;
    departureTime: string | null;
    carrier: string | null;
  }>;
  documents: Array<{
    id: number;
    bookingNumber: string;
    passengerName: string | null;
    originalName: string;
    mimeType: string;
    byteSize: number;
    status: string;
    reviewNote: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    crmContractNumber: string;
    amount: string | number;
    currency: string;
    status: string;
    provider: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }>;
  visaApplications: Array<{
    id: number;
    serviceTitle: string;
    status: string;
    documentCount: number;
    createdAt: string;
  }>;
};

const bookingStatuses: Record<string, string> = {
  pending_review: "در انتظار بررسی",
  approved: "تأیید شده",
  rejected: "رد شده",
  expired: "منقضی شده",
  paid: "پرداخت شده",
  cancelled: "لغو شده",
  pending: "در انتظار پرداخت",
  gateway_pending: "در انتظار درگاه",
  failed: "ناموفق",
  crm_sync_pending: "در انتظار همگام‌سازی",
  crm_synced: "ثبت شده",
  draft: "پیش‌نویس",
  needs_documents: "نیازمند مدرک",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function formatMoney(value: string | number | null, currency: string): string {
  if (value === null || value === undefined) return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("fa-IR")} ${currency}` : `${value} ${currency}`;
}

function formatFileSize(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
  return `${(value / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
}

function statusLabel(value: string): string {
  return bookingStatuses[value] ?? value;
}

function Stat({ icon: Icon, label, value }: { icon: typeof UsersIcon; label: string; value: string | number }) {
  return <div className="rounded-2xl border border-border bg-surface p-4"><Icon className="size-5 text-accent" /><span className="mt-3 block text-xs font-bold text-muted">{label}</span><strong className="mt-1 block text-xl font-black text-brand">{value}</strong></div>;
}

export function CustomerFilesPanel({ initialCustomers, initialTotal }: { initialCustomers: Customer[]; initialTotal: number }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [profile, setProfile] = useState<CustomerFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  async function selectCustomer(customerId: number) {
    setSelectedId(customerId);
    setProfile(null);
    setMessage("");
    setLoading(true);
    try {
      const response = await adminClientFetch(`/customers/${customerId}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setProfile((await response.json()) as CustomerFile);
    } catch {
      setMessage("دریافت پرونده مشتری ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  async function searchCustomers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (query.trim()) params.set("query", query.trim());
      const response = await adminClientFetch(`/customers?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as CustomerListResponse;
      setCustomers(result.items);
      setTotal(result.total);
      setSelectedId(null);
      setProfile(null);
    } catch {
      setMessage("جست‌وجوی مشتریان ناموفق بود. اتصال پنل را بررسی کنید.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="space-y-6" dir="rtl">
      <header className="rounded-3xl bg-brand p-6 text-white shadow-[0_18px_45px_rgba(1,37,105,.22)] sm:p-8">
        <p className="text-sm font-bold text-white/70">مدیریت مشتریان و پشتیبانی</p>
        <h1 className="mt-2 text-3xl font-black">پرونده مشتریان</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">یک مشتری را انتخاب کنید تا اطلاعات تماس، مسافران، رزروها، بلیت‌ها، مدارک، پرداخت‌ها و درخواست‌های ویزای او را در یک پرونده ببینید و اکسل همان پرونده را دانلود کنید.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-border bg-white p-4 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3"><h2 className="font-black text-brand">انتخاب مشتری</h2><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">{total.toLocaleString("fa-IR")} پرونده</span></div>
          <form className="mt-4 flex gap-2" onSubmit={searchCustomers}>
            <label className="sr-only" htmlFor="customer-file-search">جست‌وجوی نام، ایمیل یا موبایل</label>
            <input id="customer-file-search" className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-accent" onChange={(event) => setQuery(event.target.value)} placeholder="نام، ایمیل یا موبایل" value={query} />
            <button aria-label="جست‌وجوی مشتری" className="grid size-11 place-items-center rounded-xl bg-brand text-white disabled:opacity-60" disabled={searching} type="submit"><SearchIcon className="size-5" /></button>
          </form>
          <div className="mt-4 max-h-[56vh] space-y-2 overflow-y-auto pe-1">
            {customers.map((customer) => <button className={`w-full rounded-2xl border p-3 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selectedId === customer.id ? "border-accent bg-brand-soft" : "border-border bg-surface hover:border-accent/60"}`} key={customer.id} onClick={() => void selectCustomer(customer.id)} type="button"><strong className="block truncate text-sm text-brand">{customer.fullName}</strong><span className="mt-1 block truncate text-xs text-muted" dir="ltr">{customer.email}</span><span className="mt-2 flex items-center justify-between gap-2 text-xs"><span dir="ltr">{customer.phone ?? "—"}</span><span className={customer.isActive ? "text-emerald-700" : "text-red-700"}>{customer.isActive ? "فعال" : "غیرفعال"}</span></span></button>)}
            {!customers.length ? <p className="rounded-2xl bg-surface-muted p-4 text-center text-sm text-muted">مشتری مطابق جست‌وجو پیدا نشد.</p> : null}
          </div>
        </aside>

        <div className="min-w-0">
          {loading ? <div className="grid min-h-96 place-items-center rounded-3xl border border-border bg-white text-sm font-bold text-muted">در حال آماده‌سازی پرونده مشتری…</div> : null}
          {!loading && !profile ? <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-brand/25 bg-white p-8 text-center"><UsersIcon className="size-12 text-accent" /><div><h2 className="mt-4 text-xl font-black text-brand">یک پرونده را انتخاب کنید</h2><p className="mt-2 text-sm leading-7 text-muted">هر پرونده فقط برای همان مشتری است و رمز عبور یا اطلاعات بانکی را نمایش نمی‌دهد.</p></div></div> : null}
          {profile ? <CustomerProfile profile={profile} /> : null}
          {message ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}

function CustomerProfile({ profile }: { profile: CustomerFile }) {
  return <article className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-5 bg-gradient-to-l from-brand to-[#154a98] p-5 text-white sm:p-7"><div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">پرونده #{profile.id.toLocaleString("fa-IR")}</span><h2 className="mt-3 text-2xl font-black sm:text-3xl">{profile.fullName}</h2><p className="mt-2 text-sm text-white/75" dir="ltr">{profile.email}</p></div><a className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-brand shadow-sm transition hover:brightness-95" download href={`/admin-gateway/customers/${profile.id}/export.xlsx`}><ClipboardIcon className="size-5" />دانلود اکسل پرونده</a></header>
    <div className="space-y-7 p-5 sm:p-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={UsersIcon} label="مسافران ثبت‌شده" value={profile.passengers.length.toLocaleString("fa-IR")} /><Stat icon={ClipboardIcon} label="رزروها" value={profile.bookings.length.toLocaleString("fa-IR")} /><Stat icon={CreditCardIcon} label="بلیت‌های صادرشده" value={profile.tickets.length.toLocaleString("fa-IR")} /><Stat icon={ShieldIcon} label="مدارک بارگذاری‌شده" value={profile.documents.length.toLocaleString("fa-IR")} /></div>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5"><div className="flex items-center gap-2"><ShieldIcon className="size-5 text-accent" /><h3 className="font-black text-brand">اطلاعات اصلی پرونده</h3></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3"><Info icon={PhoneIcon} label="موبایل" value={profile.phone} /><Info icon={PhoneIcon} label="تماس اضطراری" value={profile.emergencyPhone} /><Info icon={ClipboardIcon} label="کد ملی" value={profile.nationalCode} /><Info icon={CalendarIcon} label="تاریخ تولد" value={profile.birthDate} /><Info icon={CalendarIcon} label="عضویت" value={formatDate(profile.createdAt)} /><Info icon={CalendarIcon} label="آخرین ورود" value={formatDate(profile.lastLoginAt)} /><Info icon={CreditCardIcon} label="اعتبار کیف پول" value={formatMoney(profile.walletCredit, profile.walletCurrency)} /><Info icon={ClipboardIcon} label="درخواست پشتیبانی" value={profile.supportRequestCount.toLocaleString("fa-IR")} /><Info icon={MailIcon} label="نشانی" value={profile.address} /></dl></section>
      <ProfileSection title="مسافران" count={profile.passengers.length}><div className="grid gap-3 md:grid-cols-2">{profile.passengers.map((passenger) => <div className="rounded-2xl border border-border p-4" key={passenger.id}><div className="flex items-start justify-between gap-3"><strong className="text-brand">{passenger.fullName}</strong>{passenger.isDefault ? <span className="rounded-full bg-brand-soft px-2 py-1 text-[11px] font-bold text-brand">مسافر پیش‌فرض</span> : null}</div><p className="mt-2 text-xs text-muted">پدر: {passenger.fatherName ?? "—"} · کد ملی: {passenger.nationalCode ?? "—"}</p><p className="mt-1 text-xs text-muted">پاسپورت: {passenger.passportNumber ?? "—"} · انقضا: {passenger.passportExpiryDate ?? "—"}</p></div>)}{!profile.passengers.length ? <Empty text="برای این مشتری مسافری ثبت نشده است." /> : null}</div></ProfileSection>
      <ProfileSection title="رزروها و خدمات" count={profile.bookings.length}><div className="space-y-3">{profile.bookings.map((booking) => <details className="rounded-2xl border border-border" key={booking.id}><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4"><div><strong className="text-brand">{booking.serviceTitles.join("، ") || "رزرو سفر"}</strong><span className="mt-1 block text-xs text-muted" dir="ltr">{booking.bookingNumber}</span></div><div className="text-left"><span className="block text-sm font-black text-brand">{formatMoney(booking.totalAmount, booking.currency)}</span><span className="text-xs text-muted">{statusLabel(booking.status)}</span></div></summary><div className="grid gap-3 border-t border-border bg-surface-muted p-4 text-sm sm:grid-cols-4"><span>پرداخت: <strong>{booking.paymentMethod === "installment" ? "اقساطی" : "نقدی"}</strong></span><span>مسافر: <strong>{booking.passengerCount.toLocaleString("fa-IR")}</strong></span><span>بلیت: <strong>{booking.ticketCount.toLocaleString("fa-IR")}</strong></span><span>مدرک: <strong>{booking.documentCount.toLocaleString("fa-IR")}</strong></span></div></details>)}{!profile.bookings.length ? <Empty text="رزروی برای این مشتری ثبت نشده است." /> : null}</div></ProfileSection>
      <ProfileSection title="مدارک بارگذاری‌شده" count={profile.documents.length}><div className="space-y-2">{profile.documents.map((document) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3" key={document.id}><div className="min-w-0"><strong className="block truncate text-sm text-brand">{document.originalName}</strong><span className="mt-1 block text-xs text-muted">{document.passengerName ?? "مدرک مشترک سفارش"} · {formatFileSize(document.byteSize)} · {statusLabel(document.status)}</span></div><a className="rounded-lg border border-accent px-3 py-2 text-xs font-black text-brand" href={`/admin-gateway/checkout/documents/${document.id}/download`} target="_blank">مشاهده مدرک</a></div>)}{!profile.documents.length ? <Empty text="مدرکی برای این مشتری بارگذاری نشده است." /> : null}</div></ProfileSection>
      <div className="grid gap-6 xl:grid-cols-2"><ProfileSection title="پرداخت‌ها" count={profile.payments.length}>{profile.payments.map((payment) => <div className="border-b border-border py-3 last:border-0" key={`${payment.crmContractNumber}-${payment.createdAt}`}><strong className="text-sm text-brand">{formatMoney(payment.amount, payment.currency)}</strong><span className="mt-1 block text-xs text-muted">{statusLabel(payment.status)} · {payment.provider ?? "ثبت دستی"} · {formatDate(payment.createdAt)}</span></div>)}{!profile.payments.length ? <Empty text="پرداختی ثبت نشده است." /> : null}</ProfileSection><ProfileSection title="درخواست‌های ویزا" count={profile.visaApplications.length}>{profile.visaApplications.map((application) => <div className="border-b border-border py-3 last:border-0" key={application.id}><strong className="text-sm text-brand">{application.serviceTitle}</strong><span className="mt-1 block text-xs text-muted">{statusLabel(application.status)} · {application.documentCount.toLocaleString("fa-IR")} مدرک</span></div>)}{!profile.visaApplications.length ? <Empty text="درخواست ویزایی ثبت نشده است." /> : null}</ProfileSection></div>
    </div>
  </article>;
}

function Info({ icon: Icon, label, value }: { icon: typeof PhoneIcon; label: string; value: string | number | null }) { return <div className="rounded-xl bg-white p-3"><span className="flex items-center gap-2 text-xs font-bold text-muted"><Icon className="size-4 text-accent" />{label}</span><strong className="mt-2 block break-words text-sm text-brand" dir={label === "موبایل" || label === "تماس اضطراری" ? "ltr" : undefined}>{value ?? "—"}</strong></div>; }
function ProfileSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black text-brand">{title}</h3><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">{count.toLocaleString("fa-IR")}</span></div>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-surface-muted p-3 text-center text-sm text-muted">{text}</p>; }
