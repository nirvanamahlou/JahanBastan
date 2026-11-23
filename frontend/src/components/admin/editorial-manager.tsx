"use client";

import { slugOnTitleEdit } from "@/lib/title-slug";
import { AutoSlugInput } from "@/components/admin/auto-slug-input";

import { type FormEvent, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateItemButton } from "@/components/admin/create-item-button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Input, Select, Textarea } from "@/components/ui/input";
import { adminClientFetch } from "@/lib/admin-client";
import { MediaUpload } from "@/components/admin/media-upload";
import { GalleryField } from "@/components/admin/gallery-field";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { InternalNoteField } from "@/components/admin/internal-note-field";
import type {
  ManagedArticle,
  ManagedArticleCategory,
  ManagedFAQ,
  PublicationStatus,
} from "@/types/editorial";

const statusOptions = [
  { label: "پیش‌نویس", value: "draft" },
  { label: "منتشرشده", value: "published" },
] as const;

function statusLabel(status: PublicationStatus) {
  if (status === "published") return "منتشرشده";
  if (status === "archived") return "بایگانی";
  return "پیش‌نویس";
}

async function articleError(response: Response | null) {
  if (!response) return "ارتباط با سرور برقرار نشد.";
  const body = (await response.json().catch(() => null)) as
    | { detail?: string | { loc?: (string | number)[]; msg?: string }[] }
    | null;
  if (typeof body?.detail === "string") {
    if (body.detail.includes("slug")) {
      return "این Slug قبلاً استفاده شده است؛ یک Slug انگلیسی و یکتا وارد کنید.";
    }
    return body.detail;
  }
  if (Array.isArray(body?.detail)) {
    const labels: Record<string, string> = {
      title: "عنوان",
      slug: "Slug",
      category: "دسته‌بندی",
      excerpt: "خلاصه",
      body: "متن مقاله",
      authorName: "نویسنده",
      imageId: "تصویر اصلی",
      galleryImageIds: "گالری تصاویر",
    };
    return body.detail
      .map((error) => {
        const field = String(error.loc?.at(-1) ?? "اطلاعات");
        return `${labels[field] ?? field}: ${error.msg ?? "نامعتبر است"}`;
      })
      .join("؛ ");
  }
  return `ذخیره مقاله ناموفق بود (خطای ${response.status}).`;
}

export function ArticleManager({ initialItems, categories }: { initialItems: ManagedArticle[]; categories: ManagedArticleCategory[] }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<ManagedArticle | null>(null);
  const [deleting, setDeleting] = useState<ManagedArticle | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageId, setImageId] = useState<number | null>(null);
  const [galleryImageIds, setGalleryImageIds] = useState<number[]>([]);

  useEffect(() => {
    // Editing is selected by an explicit user action; synchronize its gallery.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGalleryImageIds(editing?.galleryImageIds ?? []);
  }, [editing]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"),
      slug: editing ? slugOnTitleEdit(form.get("title"), editing.title, 200) : form.get("slug"),
      category: form.get("category"),
      excerpt: form.get("excerpt"),
      body: form.get("body"),
      authorName: form.get("authorName"),
      imageId,
      galleryImageIds,
      metaTitle: form.get("metaTitle") || null,
      metaDescription: form.get("metaDescription") || null,
      internalNote: form.get("internalNote") || null,
      status: form.get("status"),
    };
    const response = await adminClientFetch(
      `/admin/articles${editing ? `/${editing.id}` : ""}`,
      {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      setMessage(await articleError(response));
      return;
    }
    const saved = (await response.json()) as ManagedArticle;
    setItems((current) =>
      editing
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current],
    );
    setEditing(null);
    setImageId(null);
    setGalleryImageIds([]);
    event.currentTarget.reset();
    setMessage("مقاله با موفقیت ذخیره شد.");
  }

  async function archive() {
    if (!deleting) return;
    const response = await adminClientFetch(`/admin/articles/${deleting.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      setItems((current) => current.filter((item) => item.id !== deleting.id));
      setMessage("مقاله برای همیشه حذف شد.");
    }
    setDeleting(null);
  }

  function resetEditor() {
    setEditing(null);
    setImageId(null);
    setGalleryImageIds([]);
    setMessage("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-5"><h2 className="text-xl font-black">فهرست مقالات</h2><p className="mt-1 text-sm text-muted">{items.length.toLocaleString("fa-IR")} مورد</p></div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <article key={item.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{item.title}</h3><Badge variant={item.status === "published" ? "success" : "neutral"}>{statusLabel(item.status)}</Badge></div><p className="mt-1 text-sm text-muted">{item.category} · /{item.slug}</p></div>
              <div className="flex gap-2"><Button size="sm" variant="primary" onClick={() => { setEditing(item); setImageId(item.imageId); }}>ویرایش</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(item)}>حذف</Button></div>
            </article>
          ))}
        </div>
      </section>
      <form data-admin-save-form id="admin-article-form" onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">{editing ? "ویرایش مقاله" : "مقاله جدید"}</h2>
          <CreateItemButton formId="admin-article-form" label="مقاله" onCreate={resetEditor} />
        </div>
        <Input key={`title-${editing?.id}`} id="article-title" name="title" label="عنوان" defaultValue={editing?.title} minLength={2} required />
        <AutoSlugInput key={`slug-${editing?.id}`} id="article-slug" className="min-h-11 w-full rounded-xl border border-border px-3" defaultValue={editing?.slug} disabled={Boolean(editing)} maxLength={200} />
        <Select key={`category-${editing?.id}`} id="article-category" name="category" label="دسته‌بندی" defaultValue={editing?.category} options={categories.map((category) => ({ label: category.name, value: category.name }))} placeholder="انتخاب دسته‌بندی" required />
        <Input key={`author-${editing?.id}`} id="article-author" name="authorName" label="نویسنده" defaultValue={editing?.authorName ?? "تحریریه جهان باستان"} minLength={2} required />
        <Textarea key={`excerpt-${editing?.id}`} id="article-excerpt" name="excerpt" label="خلاصه" defaultValue={editing?.excerpt} maxLength={300} minLength={10} required />
        <RichTextEditor key={`body-${editing?.id}`} id="article-body" name="body" label="متن مقاله" defaultValue={editing?.body} minLength={20} required />
        <MediaUpload currentId={imageId} label={editing?.title ?? "تصویر مقاله"} onRemoved={() => setImageId(null)} onUploaded={setImageId} />
        <GalleryField imageIds={galleryImageIds} label="گالری مقاله" onChange={setGalleryImageIds} />
        <Input key={`meta-title-${editing?.id}`} id="article-meta-title" name="metaTitle" label="عنوان SEO" defaultValue={editing?.metaTitle ?? ""} maxLength={70} />
        <Textarea key={`meta-description-${editing?.id}`} id="article-meta-description" name="metaDescription" label="توضیحات SEO" defaultValue={editing?.metaDescription ?? ""} maxLength={160} />
        <Select key={`status-${editing?.id}`} id="article-status" name="status" label="وضعیت" options={statusOptions} defaultValue={editing?.status === "published" ? "published" : "draft"} />
        <InternalNoteField defaultValue={editing?.internalNote} />
        {message ? <Alert variant={message.includes("ذخیره شد") ? "success" : "error"}>{message}</Alert> : null}
        <Button type="submit" loading={saving} className="w-full">ذخیره مقاله</Button>
      </form>
      <ConfirmDialog open={Boolean(deleting)} title="حذف مقاله" description="مقاله برای همیشه از سایت و دیتابیس حذف می‌شود و قابل بازگردانی نیست." confirmLabel="حذف" destructive onConfirm={archive} onClose={() => setDeleting(null)} />
    </div>
  );
}

export function FAQManager({ initialItems }: { initialItems: ManagedFAQ[] }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<ManagedFAQ | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ManagedFAQ | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      question: form.get("question"),
      answer: form.get("answer"),
      category: form.get("category") || null,
      displayOrder: Number(form.get("displayOrder") || 0),
      internalNote: form.get("internalNote") || null,
      status: form.get("status"),
    };
    const response = await adminClientFetch(
      `/admin/faqs${editing ? `/${editing.id}` : ""}`,
      { method: editing ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    ).catch(() => null);
    setSaving(false);
    if (!response?.ok) return setMessage("ذخیره سوال ناموفق بود.");
    const saved = (await response.json()) as ManagedFAQ;
    setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.displayOrder - b.displayOrder));
    setEditing(null);
    event.currentTarget.reset();
    setMessage("سوال ذخیره شد.");
  }

  async function archive() {
    if (!deleting) return;
    const response = await adminClientFetch(`/admin/faqs/${deleting.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      setItems((current) => current.filter((item) => item.id !== deleting.id));
      setMessage("سؤال از سایت حذف شد.");
    }
    setDeleting(null);
  }

  function resetEditor() {
    setEditing(null);
    setMessage("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <section className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="p-5"><h2 className="text-xl font-black">سوالات متداول</h2></div>
        {items.map((item) => <article key={item.id} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words">{item.question}</strong><Badge>{statusLabel(item.status)}</Badge></div><p className="mt-1 text-xs text-muted">{item.category || "بدون دسته"} · ترتیب {item.displayOrder.toLocaleString("fa-IR")}</p></div><div className="flex w-full gap-2 sm:w-auto"><Button className="flex-1 sm:flex-none" size="sm" variant="primary" onClick={() => setEditing(item)}>ویرایش</Button><Button className="flex-1 sm:flex-none" size="sm" variant="ghost" onClick={() => setDeleting(item)}>حذف</Button></div></article>)}
      </section>
      <form data-admin-save-form id="admin-faq-form" onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">{editing ? "ویرایش سوال" : "سوال جدید"}</h2>
          <CreateItemButton formId="admin-faq-form" label="سؤال" onCreate={resetEditor} />
        </div>
        <Input key={`question-${editing?.id}`} id="faq-question" name="question" label="سوال" defaultValue={editing?.question} required />
        <RichTextEditor key={`answer-${editing?.id}`} id="faq-answer" name="answer" label="پاسخ" defaultValue={editing?.answer} required rows={5} />
        <Input key={`category-${editing?.id}`} id="faq-category" name="category" label="دسته‌بندی" defaultValue={editing?.category ?? ""} />
        <Input key={`order-${editing?.id}`} id="faq-order" name="displayOrder" label="ترتیب نمایش" type="number" min={0} defaultValue={editing?.displayOrder ?? 0} />
        <Select key={`status-${editing?.id}`} id="faq-status" name="status" label="وضعیت" options={statusOptions} defaultValue={editing?.status === "published" ? "published" : "draft"} />
        <InternalNoteField defaultValue={editing?.internalNote} />
        {message ? <Alert variant={message.includes("ناموفق") ? "error" : "success"}>{message}</Alert> : null}
        <Button type="submit" loading={saving} className="w-full">ذخیره سوال</Button>
      </form>
      <ConfirmDialog open={Boolean(deleting)} title="حذف سؤال" description="سؤال برای همیشه از سایت و دیتابیس حذف می‌شود و قابل بازگردانی نیست." confirmLabel="حذف" destructive onConfirm={archive} onClose={() => setDeleting(null)} />
    </div>
  );
}
