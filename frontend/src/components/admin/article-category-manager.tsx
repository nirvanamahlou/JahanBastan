"use client";

import { slugOnTitleEdit } from "@/lib/title-slug";
import { AutoSlugInput } from "@/components/admin/auto-slug-input";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { InternalNoteField } from "@/components/admin/internal-note-field";
import { Input } from "@/components/ui/input";
import { adminClientFetch } from "@/lib/admin-client";
import type { ManagedArticleCategory } from "@/types/editorial";

export function ArticleCategoryManager({ initialItems }: { initialItems: ManagedArticleCategory[] }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<ManagedArticleCategory | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const name = form.get("name");
    const enteredSlug = form.get("slug");
    const slug = editing && enteredSlug === editing.slug
      ? slugOnTitleEdit(name, editing.name, 100)
      : enteredSlug;
    const response = await adminClientFetch(`/admin/article-categories${editing ? `/${editing.id}` : ""}`, {
      method: editing ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, internalNote: form.get("internalNote") || null }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setMessage("ذخیره دسته‌بندی ناموفق بود؛ نام و Slug باید یکتا باشند.");
      return;
    }
    const saved = (await response.json()) as ManagedArticleCategory;
    setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
    setEditing(null);
    event.currentTarget.reset();
    setMessage("دسته‌بندی ذخیره شد. برای استفاده در فرم مقاله صفحه را تازه‌سازی کنید.");
  }

  async function remove(item: ManagedArticleCategory) {
    if (!window.confirm(`دسته‌بندی «${item.name}» حذف شود؟`)) return;
    const response = await adminClientFetch(`/admin/article-categories/${item.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      setMessage("این دسته‌بندی در مقاله‌ها استفاده شده و قابل حذف نیست.");
      return;
    }
    setItems((current) => current.filter((category) => category.id !== item.id));
    setMessage("دسته‌بندی حذف شد.");
  }

  return <section className="rounded-2xl border border-border bg-surface p-5">
    <h2 className="text-xl font-black">دسته‌بندی‌های مقاله</h2>
    <form data-admin-save-form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" key={editing?.id ?? "new"} onSubmit={save}>
      <Input id="article-category-name" label="نام دسته‌بندی" name="name" defaultValue={editing?.name} required />
      <AutoSlugInput id="article-category-slug" className="min-h-11 w-full rounded-xl border border-border px-3" sourceName="name" defaultValue={editing?.slug} maxLength={100} />
      <div className="flex items-end gap-2"><Button loading={busy} type="submit">{editing ? "ذخیره ویرایش" : "افزودن"}</Button>{editing ? <Button onClick={() => setEditing(null)} type="button" variant="ghost">انصراف</Button> : null}</div>
      <div className="md:col-span-3"><InternalNoteField defaultValue={editing?.internalNote} /></div>
    </form>
    <div className="mt-5 flex flex-wrap gap-2">{items.map((item) => <div data-admin-search-item className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm" key={item.id}><strong>{item.name}</strong><button className="text-brand" onClick={() => setEditing(item)} type="button">ویرایش</button><button className="text-danger" onClick={() => void remove(item)} type="button">حذف</button></div>)}</div>
    {message ? <div className="mt-4"><Alert variant={message.includes("ناموفق") || message.includes("قابل حذف") ? "error" : "success"}>{message}</Alert></div> : null}
  </section>;
}
