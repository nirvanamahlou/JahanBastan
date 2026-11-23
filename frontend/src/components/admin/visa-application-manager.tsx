"use client";

import { useState } from "react";

import { formatPersianDateTime } from "@/lib/persian-date";

type Application = {
  id: number;
  status: string;
  customerMessage: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { fullName: string; email: string; phone: string | null };
  travelService: { title: string; country: string | null; visaType: string | null };
  documents: Array<{ id: number; originalName: string; documentType: string; mimeType: string; byteSize: number; createdAt: string }>;
};

const labels: Record<string, string> = {
  pending_review: "در انتظار بررسی",
  needs_documents: "مدارک بیشتر",
  approved: "قابل انجام",
  rejected: "رد شده",
};

export function VisaApplicationManager({ initialItems }: { initialItems: Application[] }) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState<number | null>(null);

  async function save(id: number, form: FormData) {
    setSaving(id);
    const response = await fetch(`/admin-gateway/admin/visa-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.get("status"),
        customerMessage: form.get("customerMessage") || null,
        internalNote: form.get("internalNote") || null,
      }),
    });
    if (response.ok) {
      const updated = await response.json() as Application;
      setItems((current) => current.map((item) => item.id === id ? updated : item));
    }
    setSaving(null);
  }

  if (!items.length) {
    return <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted">درخواست ویزایی برای بررسی وجود ندارد.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <form className="rounded-2xl border border-border bg-white p-5 shadow-sm" key={item.id} onSubmit={(event) => { event.preventDefault(); void save(item.id, new FormData(event.currentTarget)); }}>
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="font-black text-brand">{item.travelService.title}</h2>
              <p className="mt-1 text-sm text-muted">{item.customer.fullName} · {item.customer.email} · {item.customer.phone ?? "موبایل ثبت نشده"}</p>
              <time className="mt-2 block text-xs font-bold text-muted">زمان ثبت درخواست: {formatPersianDateTime(item.createdAt)}</time>
            </div>
            <select className="rounded-xl border border-border px-3 text-sm" defaultValue={item.status} name="status">
              {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <section className="mt-4 rounded-2xl border border-brand/15 bg-surface-muted p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="font-black text-brand">مدارک بارگذاری‌شده</h3><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand">{item.documents.length.toLocaleString("fa-IR")} فایل</span></div>
            {item.documents.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{item.documents.map((document) => <li className="rounded-xl border border-border bg-white p-3" key={document.id}><strong className="block truncate text-sm text-foreground" title={document.originalName}>{document.originalName}</strong><span className="mt-1 block text-xs text-muted">{document.documentType} · {document.mimeType} · {Math.ceil(document.byteSize / 1024).toLocaleString("fa-IR")} KB</span><time className="mt-1 block text-xs text-muted">بارگذاری: {formatPersianDateTime(document.createdAt)}</time><a className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg border border-brand px-3 text-xs font-black text-brand hover:bg-brand-soft" href={`/admin-gateway/admin/visa-applications/${item.id}/documents/${document.id}`} rel="noreferrer" target="_blank">مشاهده و دانلود مدرک</a></li>)}</ul> : <p className="mt-3 text-sm text-muted">مدرکی بارگذاری نشده است.</p>}
          </section>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><textarea className="min-h-24 rounded-xl border border-border p-3 text-sm" defaultValue={item.customerMessage ?? ""} name="customerMessage" placeholder="پیام قابل مشاهده برای مسافر"/><textarea className="min-h-24 rounded-xl border border-border p-3 text-sm" defaultValue={item.internalNote ?? ""} name="internalNote" placeholder="یادداشت خصوصی کارشناس"/></div>
          <button className="mt-3 min-h-10 rounded-xl bg-brand px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving === item.id} type="submit">ذخیره بررسی</button>
        </form>
      ))}
    </div>
  );
}