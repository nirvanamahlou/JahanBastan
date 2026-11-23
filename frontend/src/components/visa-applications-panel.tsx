"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";

type VisaService = {
  id: number;
  title: string;
  country: string | null;
  visaType: string | null;
  basePrice: string | null;
  currency: string;
  visaFormUrl: string | null;
  visaDocumentRequirements: string[];
};
type Document = { id: number; originalName: string; documentType: string; mimeType: string; byteSize: number; createdAt: string };
type Application = {
  id: number;
  status: string;
  customerMessage: string | null;
  createdAt: string;
  travelService: VisaService;
  documents: Document[];
};

const statusText: Record<string, string> = {
  draft: "در حال تکمیل مدارک",
  pending_review: "در انتظار بررسی",
  needs_documents: "نیاز به مدارک بیشتر",
  approved: "قابل انجام",
  rejected: "امکان انجام ندارد",
};
const typeText: Record<string, string> = {
  tourist: "توریستی",
  business: "تجاری",
  exhibition: "نمایشگاهی",
  residency: "اقامتی",
  student: "دانشجویی",
};
const fallbackRequirements = [
  "تصویر صفحه اول پاسپورت",
  "عکس پرسنلی",
  "تصویر کارت ملی",
  "مدرک تمکن مالی یا گردش حساب",
];

function requiredDocuments(service: VisaService) {
  return service.visaDocumentRequirements?.length
    ? service.visaDocumentRequirements
    : fallbackRequirements;
}

function formatDocumentSize(byteSize: number) {
  if (byteSize < 1024 * 1024) return `${Math.max(1, Math.round(byteSize / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
  return `${(byteSize / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
}

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export function VisaApplicationsPanel() {
  const searchParams = useSearchParams();
  const requestedServiceId = searchParams.get("serviceId") ?? "";
  const [services, setServices] = useState<VisaService[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState(requestedServiceId);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  async function load() {
    const [visaResponse, applicationResponse] = await Promise.all([
      fetch(`${PUBLIC_API_BASE_URL}/services?type=visa&pageSize=100`, { cache: "no-store" }),
      fetch(`${PUBLIC_API_BASE_URL}/account/visa-applications`, {
        credentials: "include",
        cache: "no-store",
      }),
    ]);
    if (visaResponse.ok) setServices((await visaResponse.json()).items as VisaService[]);
    if (applicationResponse.ok) setApplications((await applicationResponse.json()) as Application[]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/visa-applications`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ travelServiceId: Number(selected) }),
    }).catch(() => null);
    setBusy(false);
    setNotice(
      response?.ok
        ? "درخواست اولیه ایجاد شد. مدارک لازم را بارگذاری و سپس ارسال نهایی را تأیید کنید."
        : "ثبت درخواست ناموفق بود. ابتدا وارد حساب کاربری شوید.",
    );
    if (response?.ok) {
      setSelected("");
      await load();
    }
  }

  async function upload(applicationId: number, documentType: string, file: File | null) {
    if (!file) return;
    const uploadKey = `${applicationId}:${documentType}`;
    setUploading(uploadKey);
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    const response = await fetch(
      `${PUBLIC_API_BASE_URL}/account/visa-applications/${applicationId}/documents`,
      { method: "POST", credentials: "include", body: form },
    ).catch(() => null);
    setUploading("");
    setNotice(
      response?.ok
        ? `${documentType} با موفقیت برای بررسی ارسال شد.`
        : "بارگذاری ناموفق بود. فقط PDF، JPG، PNG یا WebP تا ۱۰ مگابایت مجاز است.",
    );
    if (response?.ok) await load();
  }

  async function submitForReview(applicationId: number) {
    setSubmittingId(applicationId);
    const response = await fetch(
      `${PUBLIC_API_BASE_URL}/account/visa-applications/${applicationId}/submit`,
      { method: "POST", credentials: "include" },
    ).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setSubmittingId(null);
    if (response?.ok) {
      setNotice("درخواست برای اقدام کارشناسی ارسال شد و اکنون در پنل مدیریت قابل بررسی است.");
      await load();
      return;
    }
    const missing = Array.isArray(payload?.detail?.missing)
      ? payload.detail.missing.join("، ")
      : "";
    setNotice(
      missing
        ? `ابتدا مدارک الزامی زیر را بارگذاری کنید: ${missing}`
        : "ارسال درخواست ناموفق بود. حداقل یک مدرک معتبر بارگذاری کنید.",
    );
  }
  return (
    <section className="space-y-5" dir="rtl" id="visa-applications">
      <header>
        <h1 className="text-2xl font-black text-brand">درخواست ویزا و اقدام کارشناسی</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
          نوع ویزا را انتخاب کنید؛ سپس هر مدرک را در فیلد مخصوص خودش بارگذاری نمایید.
          فایل‌ها خصوصی‌اند و فقط کارشناسان مجاز به آن‌ها دسترسی دارند.
        </p>
      </header>
      {notice ? <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm font-bold text-brand" role="status" aria-live="polite" aria-atomic="true">{notice}</p> : null}
      <form className="rounded-2xl border border-border bg-surface p-5 shadow-sm" onSubmit={create}>
        <h2 className="font-black text-brand">ایجاد درخواست اقدام کارشناسی</h2>
        <p className="mt-1 text-sm text-muted">هزینه و مدارک لازم هر ویزا پیش از ثبت درخواست مشخص است.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <select aria-label="کشور و نوع ویزا" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm" onChange={(event) => setSelected(event.target.value)} required value={selected}>
            <option value="">انتخاب کشور و نوع ویزا</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.country} — {typeText[service.visaType ?? ""] ?? "ویزای عمومی"} — {service.basePrice ? formatCurrency(service.basePrice, service.currency) : "استعلام قیمت"}</option>)}
          </select>
          <button className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-white disabled:opacity-60" disabled={busy || !selected} type="submit">شروع بارگذاری مدارک</button>
        </div>
      </form>
      <div className="space-y-4">
        {applications.length ? applications.map((application) => {
          const requirements = requiredDocuments(application.travelService);
          const missingRequirements = requirements.filter(
            (requirement) => !application.documents.some(
              (document) => document.documentType === requirement,
            ),
          );
          const canEditDocuments = ["draft", "needs_documents"].includes(application.status);
          const canSubmit = canEditDocuments
            && application.documents.length > 0
            && missingRequirements.length === 0;
          return <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm" key={application.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-black text-brand">{application.travelService.title}</h2><p className="mt-1 text-sm text-muted">{application.travelService.country} · {typeText[application.travelService.visaType ?? ""] ?? "ویزا"}</p></div>
              <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-black text-brand">{statusText[application.status] ?? application.status}</span>
            </div>
            {application.customerMessage ? <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm text-foreground">پیام کارشناس: {application.customerMessage}</p> : null}
            {application.travelService.visaFormUrl ? <section className="mt-5 rounded-2xl border border-brand/20 bg-brand/5 p-4" aria-label="فرم نمونه ویزا">
              <h3 className="font-black text-brand">فرم نمونه درخواست ویزا</h3>
              <p className="mt-1 text-sm leading-7 text-muted">فرم را دانلود کنید، کامل و دقیق با خودکار آبی پر کنید و نسخه اسکن‌شده را در بخش مدارک بارگذاری کنید.</p>
              <a className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-primary" download href={application.travelService.visaFormUrl}>دانلود فرم نمونه</a>
            </section> : null}
            <div className="mt-5">
              <h3 className="font-black text-brand">مدارک موردنیاز این ویزا</h3>
              <p className="mt-1 text-xs leading-6 text-muted">فرمت مجاز PDF، JPG، PNG و WebP؛ حداکثر حجم هر فایل ۱۰ مگابایت.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {requirements.map((requirement) => {
                  const uploaded = application.documents.filter((document) => document.documentType === requirement);
                  const key = `${application.id}:${requirement}`;
                  return <div className="rounded-2xl border border-border bg-surface-muted p-4" key={requirement}>
                    <div className="flex items-start justify-between gap-3"><strong className="text-sm text-brand">{requirement}</strong><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${uploaded.length ? "bg-emerald-100 text-emerald-700" : "bg-accent/45 text-brand"}`}>{uploaded.length ? "بارگذاری شده" : "در انتظار فایل"}</span></div>
                    {uploaded.map((document) => <a className="mt-2 block truncate text-xs font-bold text-brand underline" href={`${PUBLIC_API_BASE_URL}/account/visa-applications/${application.id}/documents/${document.id}`} key={document.id}>{document.originalName}</a>)}
                    {canEditDocuments ? <label className="mt-3 flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-brand px-3 text-xs font-black text-white transition hover:bg-primary">
                      {uploading === key ? "در حال بارگذاری..." : uploaded.length ? "بارگذاری فایل جدید" : "انتخاب و بارگذاری فایل"}
                      <input aria-label="انتخاب فایل مدرک ویزا" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={Boolean(uploading)} onChange={(event) => void upload(application.id, requirement, event.target.files?.[0] ?? null)} type="file" />
                    </label> : null}
                  </div>;
                })}
              </div>
            </div>
            <section className="mt-5 rounded-2xl border border-brand/15 bg-white/70 p-4" aria-labelledby={`uploaded-visa-documents-${application.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-brand" id={`uploaded-visa-documents-${application.id}`}>مدارک بارگذاری‌شده شما</h3>
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">{application.documents.length.toLocaleString("fa-IR")} فایل</span>
              </div>
              {application.documents.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {application.documents.map((document) => (
                    <li className="rounded-xl border border-border bg-surface p-3" key={document.id}>
                      <strong className="block truncate text-sm text-foreground" title={document.originalName}>{document.originalName}</strong>
                      <span className="mt-1 block text-xs text-muted">{document.documentType} · {formatDocumentSize(document.byteSize)}</span>
                      <span className="mt-1 block text-[11px] text-muted">بارگذاری در {formatUploadDate(document.createdAt)}</span>
                      <a className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg border border-brand px-3 text-xs font-black text-brand transition hover:bg-accent" href={`${PUBLIC_API_BASE_URL}/account/visa-applications/${application.id}/documents/${document.id}`} rel="noreferrer" target="_blank">مشاهده و دانلود مدرک</a>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-muted">هنوز مدرکی برای این درخواست بارگذاری نشده است.</p>}
            </section>
            {canEditDocuments ? <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/5 p-4">
              {missingRequirements.length ? <p className="mb-3 text-sm font-bold text-brand">مدارک باقی‌مانده: {missingRequirements.join("، ")}</p> : null}
              <button
                className="min-h-11 w-full rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSubmit || submittingId === application.id}
                onClick={() => void submitForReview(application.id)}
                type="button"
              >
                {submittingId === application.id ? "در حال ارسال..." : application.status === "needs_documents" ? "ارسال مجدد برای اقدام کارشناسی" : "تأیید و ارسال برای اقدام کارشناسی"}
              </button>
            </div> : null}
          </article>;
        }) : <p className="rounded-2xl border border-dashed border-border bg-surface p-7 text-center text-sm text-muted">هنوز درخواست ویزایی ثبت نکرده‌اید.</p>}
      </div>
    </section>
  );
}