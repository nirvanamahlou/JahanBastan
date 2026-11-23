"use client";

import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { useState, type FormEvent } from "react";

export type AvinaTourEditorial = {
  kind: "tour" | "floating-tour";
  resourceId: string;
  sourceTitle: string | null;
  title: string | null;
  summary: string | null;
  description: string | null;
  hidden: boolean;
};

export function AvinaTourEditor({ tour, onSave, onClose }: {
  tour: AvinaTourEditorial;
  onSave: (tour: AvinaTourEditorial) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newTitle = String(data.get("title") || "").trim();
    const values = {
      title: newTitle || null,
      summary: String(data.get("summary") || "").trim() || null,
      description: String(data.get("description") || "").trim() || null,
      hidden: data.has("hidden"),
    };
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/admin-gateway/admin/avina-tours/" + tour.kind + "/" + encodeURIComponent(tour.resourceId), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error();
      onSave({ ...tour, ...values });
      setStatus("تغییرات ذخیره شد.");
    } catch {
      setStatus("ذخیره انجام نشد. دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }
  return <form onSubmit={save} className="tour-admin-form space-y-4 rounded-2xl border border-border bg-surface p-5">
      <header className="rounded-xl bg-surface-muted p-3">
        <h2 className="text-xl font-black">ویرایش تور</h2>
        <p className="mt-1 text-sm text-muted">{tour.title || tour.sourceTitle || "تور آوینا"} · آوینا</p>
      </header>
      <label className="grid gap-1">عنوان نمایشی <input name="title" defaultValue={tour.title ?? ""} maxLength={180} placeholder={tour.sourceTitle ?? undefined} className="rounded-lg border p-2" /></label>
      <label className="grid gap-1">خلاصه <textarea name="summary" defaultValue={tour.summary ?? ""} maxLength={300} className="rounded-lg border p-2" /></label>
      <RichTextEditor label="توضیحات کامل تور" name="description" defaultValue={tour.description ?? ""} rows={5} />
      <label className="flex items-center gap-2"><input type="checkbox" name="hidden" defaultChecked={tour.hidden} /> مخفی کردن در سایت</label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-bold text-white disabled:opacity-60">ذخیره</button>
        <button type="button" onClick={onClose} className="text-sm text-brand">انصراف از ویرایش</button>
        <span role="status">{status}</span>
      </div>
    </form>;
}
