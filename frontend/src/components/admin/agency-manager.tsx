"use client";

import { useMemo, useState } from "react";

import { SiteSelect } from "@/components/ui/site-select";
import { adminClientFetch } from "@/lib/admin-client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDateTime } from "@/lib/persian-date";

export type Agency = {
  id: number;
  customerId: number;
  accountEmail: string;
  accountFullName: string;
  legalName: string;
  registrationNumber: string;
  nationalId: string | null;
  economicCode: string | null;
  licenseNumber: string;
  managerName: string;
  managerNationalCode: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string | null;
  status: "pending" | "approved" | "rejected";
  creditLimit: string;
  creditUsed: string;
  creditReserved: string;
  availableCredit: string;
  currency: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

const statusLabels = {
  pending: "در انتظار بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
};

export function AgencyManager({ initial }: { initial: Agency[] }) {
  const [agencies, setAgencies] = useState(initial);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const visible = useMemo(() => agencies.filter((agency) => {
    const matchesStatus = filter === "all" || agency.status === filter;
    const needle = query.trim().toLocaleLowerCase("fa-IR");
    const matchesQuery = !needle || [agency.legalName, agency.accountEmail, agency.nationalId, agency.economicCode, agency.registrationNumber, agency.accountFullName].filter(Boolean).some((value) => value!.toLocaleLowerCase("fa-IR").includes(needle));
    return matchesStatus && matchesQuery;
  }), [agencies, filter, query]);

  async function review(formElement: HTMLFormElement, agency: Agency, status: "approved" | "rejected") {
    const form = new FormData(formElement);
    const creditLimit = status === "approved" ? Number(form.get("creditLimit")) : 0;
    if (status === "approved" && (!Number.isFinite(creditLimit) || creditLimit < Number(agency.creditUsed) + Number(agency.creditReserved))) {
      setNotice("سقف اعتبار باید عددی معتبر و حداقل برابر اعتبار مصرف‌شده و رزروشده باشد.");
      return;
    }
    setBusyId(agency.id);
    setNotice("");
    const response = await adminClientFetch(`/admin/agencies/${agency.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, creditLimit, reviewNote: String(form.get("reviewNote") || "").trim() || null }),
    }).catch(() => null);
    setBusyId(null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null) as { detail?: string } | null;
      setNotice(body?.detail || "ثبت نتیجه بررسی آژانس ناموفق بود.");
      return;
    }
    const updated = await response.json() as Agency;
    setAgencies((current) => current.map((item) => item.id === updated.id ? updated : item));
    setNotice(status === "approved" ? "آژانس تأیید و اعتبار آن فعال شد." : "درخواست آژانس رد شد.");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-[1fr_15rem]">
        <input className="min-h-11 rounded-xl border border-border px-3 text-sm outline-none focus:border-brand" onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی آژانس، کانتر، ایمیل، شناسه ملی یا کد اقتصادی" value={query} />
        <SiteSelect ariaLabel="فیلتر وضعیت آژانس" id="agency-status-filter" onValueChange={setFilter} options={[{ label: "همه وضعیت‌ها", value: "all" }, { label: "در انتظار بررسی", value: "pending" }, { label: "تأییدشده", value: "approved" }, { label: "ردشده", value: "rejected" }]} value={filter} />
      </div>
      {notice ? <p className="rounded-xl border border-brand/15 bg-brand-soft p-3 text-sm font-bold text-brand" role="status">{notice}</p> : null}
      <div className="grid gap-4">
        {visible.map((agency) => (
          <article className="rounded-3xl border border-border bg-white p-5 shadow-sm" key={agency.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-black text-brand">{agency.legalName}</h2><p className="mt-1 text-sm text-muted">کانتر فروش: <strong>{agency.accountFullName}</strong> · <span dir="ltr">{agency.accountEmail}</span></p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${agency.status === "approved" ? "bg-emerald-100 text-emerald-800" : agency.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{statusLabels[agency.status]}</span>
            </div>
            <dl className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-muted">شماره ثبت</dt><dd className="font-black text-brand">{agency.registrationNumber}</dd></div><div><dt className="text-muted">شناسه ملی</dt><dd className="font-black text-brand">{agency.nationalId || "ثبت نشده"}</dd></div><div><dt className="text-muted">کد اقتصادی</dt><dd className="font-black text-brand">{agency.economicCode || "ثبت نشده"}</dd></div><div><dt className="text-muted">مجوز گردشگری</dt><dd className="font-black text-brand">{agency.licenseNumber}</dd></div><div><dt className="text-muted">مدیرعامل</dt><dd className="font-black text-brand">{agency.managerName}</dd></div><div><dt className="text-muted">کد ملی مدیرعامل</dt><dd className="font-black text-brand">{agency.managerNationalCode}</dd></div><div><dt className="text-muted">شماره موبایل مدیرعامل</dt><dd className="font-black text-brand" dir="ltr">{agency.phone}</dd></div><div><dt className="text-muted">محل</dt><dd className="font-black text-brand">{agency.province}، {agency.city}</dd></div><div className="sm:col-span-2 lg:col-span-4"><dt className="text-muted">نشانی</dt><dd className="font-black text-brand">{agency.address}</dd></div><div><dt className="text-muted">تاریخ درخواست</dt><dd className="font-black text-brand">{formatPersianDateTime(agency.createdAt)}</dd></div>
            </dl>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border p-3"><span className="text-xs text-muted">سقف اعتبار</span><strong className="mt-1 block text-brand">{formatCurrency(agency.creditLimit, agency.currency)}</strong></div><div className="rounded-xl border border-border p-3"><span className="text-xs text-muted">مصرف‌شده + رزروشده</span><strong className="mt-1 block text-brand">{formatCurrency(Number(agency.creditUsed) + Number(agency.creditReserved), agency.currency)}</strong></div><div className="rounded-xl border border-border p-3"><span className="text-xs text-muted">قابل استفاده</span><strong className="mt-1 block text-emerald-700">{formatCurrency(agency.availableCredit, agency.currency)}</strong></div></div>
            <form className="mt-4 grid gap-3 rounded-2xl border border-brand/15 p-4 md:grid-cols-[14rem_1fr_auto_auto]" onSubmit={(event) => { event.preventDefault(); void review(event.currentTarget, agency, "approved"); }}>
              <label className="grid gap-1 text-xs font-bold text-brand">سقف اعتبار (تومان)<input className="min-h-11 rounded-xl border border-border px-3 text-sm" defaultValue={agency.creditLimit} min={0} name="creditLimit" required type="number" /></label>
              <label className="grid gap-1 text-xs font-bold text-brand">یادداشت پشتیبان<input className="min-h-11 rounded-xl border border-border px-3 text-sm" defaultValue={agency.reviewNote ?? ""} maxLength={1000} name="reviewNote" /></label>
              <button className="min-h-11 self-end rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50" disabled={busyId === agency.id} type="submit">تأیید و اعمال اعتبار</button>
              <button className="min-h-11 self-end rounded-xl border border-red-300 px-5 text-sm font-black text-red-700 disabled:opacity-50" disabled={busyId === agency.id} onClick={(event) => { if (event.currentTarget.form) void review(event.currentTarget.form, agency, "rejected"); }} type="button">رد درخواست</button>
            </form>
          </article>
        ))}
      </div>
      {!visible.length ? <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted">درخواستی با این فیلتر پیدا نشد.</p> : null}
    </div>
  );
}
