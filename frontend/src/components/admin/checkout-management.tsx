"use client";

import { type FormEvent, useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";

type Requirement = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  appliesTo: string;
  isRequired: boolean;
  isActive: boolean;
  allowedExtensions: string[];
  maxBytes: number;
  displayOrder: number;
};

type Document = {
  id: number;
  bookingId: number;
  bookingNumber: string | null;
  customerId: number;
  customerName: string | null;
  requirementId: number | null;
  passengerIndex: number | null;
  passengerName: string | null;
  originalName: string;
  mimeType: string;
  byteSize: number;
  status: string;
  reviewNote: string | null;
  createdAt: string;
};

type CustomerDocumentGroup = {
  id: number;
  name: string;
  documentCount: number;
  pendingCount: number;
  bookingNumbers: Set<string>;
};

const categoryLabels: Record<string, string> = {
  identity: "هویتی",
  travel: "سفر",
  visa: "ویزا",
  installment: "اقساط",
  payment: "پرداخت",
  other: "سایر",
};

const appliesLabels: Record<string, string> = {
  all: "همه سفارش‌ها",
  tour: "تور",
  flight: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
  installment: "فقط اقساطی",
};

function documentGroupKey(document: Document) {
  return document.passengerIndex === null
    ? `booking-${document.bookingId}-general`
    : `booking-${document.bookingId}-passenger-${document.passengerIndex}`;
}

export function CheckoutManagement({
  initialRequirements,
  initialDocuments,
}: {
  initialRequirements: Requirement[];
  initialDocuments: Document[];
}) {
  const [requirements, setRequirements] = useState(initialRequirements);
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const customerGroups = Array.from(
    documents.reduce((groups, document) => {
      const current = groups.get(document.customerId);
      if (current) {
        current.documentCount += 1;
        current.pendingCount += document.status === "pending" ? 1 : 0;
        if (document.bookingNumber) current.bookingNumbers.add(document.bookingNumber);
      } else {
        groups.set(document.customerId, {
          id: document.customerId,
          name: document.customerName ?? `مشتری #${document.customerId}`,
          documentCount: 1,
          pendingCount: document.status === "pending" ? 1 : 0,
          bookingNumbers: new Set(document.bookingNumber ? [document.bookingNumber] : []),
        });
      }
      return groups;
    }, new Map<number, CustomerDocumentGroup>()).values(),
  ).sort((left, right) => right.pendingCount - left.pendingCount || right.documentCount - left.documentCount || left.name.localeCompare(right.name, "fa"));
  const selectedCustomer = customerGroups.find((item) => item.id === selectedCustomerId) ?? null;
  const visibleDocuments = selectedCustomerId === null
    ? []
    : documents.filter((document) => document.customerId === selectedCustomerId);  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const response = await adminClientFetch(
      "/admin/checkout/document-requirements",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(data.get("title") ?? ""),
          description: String(data.get("description") ?? "") || null,
          category: data.get("category"),
          appliesTo: data.get("appliesTo"),
          isRequired: data.get("isRequired") === "on",
          isActive: true,
          allowedExtensions: ["pdf", "jpg", "jpeg", "png"],
          maxBytes: Number(data.get("maxBytes")) * 1024 * 1024,
          displayOrder: Number(data.get("displayOrder")),
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as Requirement | { detail?: string } | null;
    setBusy(false);
    if (!response.ok || !body || !("title" in body)) {
      setMessage(body && "detail" in body ? body.detail ?? "ثبت ناموفق بود." : "ثبت ناموفق بود.");
      return;
    }
    setRequirements((current) => [...current, body].sort((a, b) => a.displayOrder - b.displayOrder));
    event.currentTarget.reset();
    setMessage("نوع مدرک جدید ثبت شد و در سبد خرید نمایش داده می‌شود.");
  }

  async function review(document: Document, status: "approved" | "rejected") {
    const note = window.prompt(status === "approved" ? "یادداشت تأیید (اختیاری)" : "دلیل رد مدرک") ?? "";
    const response = await adminClientFetch(
      `/admin/checkout/documents/${document.id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: note || null }),
      },
    );
    const body = (await response.json().catch(() => null)) as Document | null;
    if (response.ok && body) {
      setDocuments((current) => current.map((item) => item.id === document.id ? body : item));
    }
  }

  return (
    <div className="space-y-8" dir="rtl">
      {message ? <p className="rounded-2xl bg-brand-soft p-4 text-sm font-bold text-brand" role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}

      <section className="rounded-3xl border border-border bg-white p-6">
        <header>
          <p className="text-sm font-bold text-accent-strong">متصل به مرحله مدارک سبد خرید</p>
          <h2 className="mt-2 text-2xl font-black text-brand">مدارک موردنیاز</h2>
          <p className="mt-2 text-sm leading-7 text-muted">هر مورد فعال بر اساس نوع محصول و روش پرداخت به مسافر نمایش داده می‌شود.</p>
        </header>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead><tr className="bg-surface-muted text-right"><th className="p-3">عنوان</th><th className="p-3">دسته</th><th className="p-3">کاربرد</th><th className="p-3">اجباری</th><th className="p-3">حجم</th><th className="p-3">وضعیت</th></tr></thead>
            <tbody>{requirements.map((item) => <tr className="border-t border-border" key={item.id}><td className="p-3"><strong className="text-brand">{item.title}</strong><p className="mt-1 text-xs text-muted">{item.description}</p></td><td className="p-3">{categoryLabels[item.category] ?? item.category}</td><td className="p-3">{appliesLabels[item.appliesTo] ?? item.appliesTo}</td><td className="p-3">{item.isRequired ? "بله" : "خیر"}</td><td className="p-3">{Math.round(item.maxBytes / 1024 / 1024)} MB</td><td className="p-3">{item.isActive ? "فعال" : "غیرفعال"}</td></tr>)}</tbody>
          </table>
        </div>
        <form className="mt-6 grid gap-3 rounded-2xl border border-dashed border-brand/30 bg-brand/5 p-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={createRequirement}>
          <label className="grid gap-1 text-sm font-bold">عنوان<input className="min-h-11 rounded-xl border border-border bg-white px-3" maxLength={120} name="title" required /></label>
          <label className="grid gap-1 text-sm font-bold">دسته<select className="min-h-11 rounded-xl border border-border bg-white px-3" name="category">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-bold">نمایش برای<select className="min-h-11 rounded-xl border border-border bg-white px-3" name="appliesTo">{Object.entries(appliesLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-bold">حداکثر حجم (MB)<input className="min-h-11 rounded-xl border border-border bg-white px-3" defaultValue="8" max="20" min="1" name="maxBytes" type="number" /></label>
          <label className="grid gap-1 text-sm font-bold md:col-span-2 xl:col-span-3">توضیحات<input className="min-h-11 rounded-xl border border-border bg-white px-3" maxLength={500} name="description" /></label>
          <label className="flex items-center gap-2 text-sm font-bold"><input defaultChecked name="isRequired" type="checkbox" /> مدرک اجباری است</label>
          <input name="displayOrder" type="hidden" value={requirements.length * 10 + 10} />
          <button className="rounded-xl bg-brand px-5 py-3 font-black text-white disabled:opacity-50" disabled={busy} type="submit">افزودن نوع مدرک</button>
        </form>
      </section>

      <section className="rounded-3xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-accent-strong">مدارک خصوصی مشتریان</p>
            <h2 className="mt-1 text-2xl font-black text-brand">صف بررسی مدارک</h2>
            <p className="mt-2 text-sm text-muted">ابتدا مشتری را انتخاب کنید؛ سپس فقط مدارک همان مشتری، همراه با سفارش و مسافر مربوطه، نمایش داده می‌شود.</p>
          </div>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">{customerGroups.length.toLocaleString("fa-IR")} مشتری · {documents.length.toLocaleString("fa-IR")} فایل</span>
        </div>

        {selectedCustomer === null ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customerGroups.map((customer) => (
              <button
                aria-label={`مشاهده مدارک ${customer.name}`}
                className="group rounded-2xl border border-border bg-surface-muted p-4 text-right transition hover:border-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div><strong className="block text-lg font-black text-brand">{customer.name}</strong><span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted">{customer.bookingNumbers.size.toLocaleString("fa-IR")} سفارش</span></div>
                  {customer.pendingCount ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900">{customer.pendingCount.toLocaleString("fa-IR")} در انتظار</span> : <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">بررسی شده</span>}
                </div>
                <p className="mt-4 text-sm font-bold text-brand">مشاهده {customer.documentCount.toLocaleString("fa-IR")} مدرک <span aria-hidden="true" className="mr-1 inline-block transition-transform group-hover:-translate-x-1">←</span></p>
              </button>
            ))}
            {!customerGroups.length ? <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-muted">هنوز مدرکی برای بررسی بارگذاری نشده است.</p> : null}
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft p-4">
              <div><h3 className="text-xl font-black text-brand">مدارک {selectedCustomer.name}</h3><p className="mt-1 text-sm text-muted">{selectedCustomer.documentCount.toLocaleString("fa-IR")} فایل در {selectedCustomer.bookingNumbers.size.toLocaleString("fa-IR")} سفارش</p></div>
              <button className="rounded-xl border border-brand bg-white px-4 py-2 text-sm font-black text-brand hover:bg-brand" onClick={() => setSelectedCustomerId(null)} type="button">بازگشت به مشتری‌ها</button>
            </div>
            <div className="mt-4 grid gap-3">
              {visibleDocuments.map((document) => {
                const requirement = requirements.find((item) => item.id === document.requirementId);
                const statusLabel = document.status === "pending" ? "در انتظار بررسی" : document.status === "approved" ? "تأیید شده" : "رد شده";
                return <article className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-4" key={document.id}><div><strong className="text-brand">{document.passengerName ?? "مدرک مشترک سفارش"} · {requirement?.title ?? "مدرک عمومی"}</strong><p className="mt-1 text-xs text-muted">{document.bookingNumber ?? `سفارش #${document.bookingId}`} · {document.originalName} · {Math.round(document.byteSize / 1024)} KB · {new Date(document.createdAt).toLocaleString("fa-IR")}</p><p className="mt-2 text-xs font-bold text-brand">{statusLabel}{document.reviewNote ? ` · ${document.reviewNote}` : ""}</p></div><div className="flex flex-wrap gap-2"><a className="rounded-xl border border-brand px-4 py-2 text-sm font-black text-brand" href={`/admin-gateway/admin/checkout/documents/${document.id}/download`}>مشاهده فایل</a>{document.status === "pending" ? <><button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white" onClick={() => void review(document, "approved")} type="button">تأیید</button><button className="rounded-xl border border-red-300 px-4 py-2 text-sm font-black text-red-700" onClick={() => void review(document, "rejected")} type="button">رد و درخواست مجدد</button></> : null}</div></article>;
              })}
            </div>
          </div>
        )}
      </section>    </div>
  );
}
