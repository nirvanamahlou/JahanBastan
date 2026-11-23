"use client";

import { type FormEvent, useState } from "react";

import { MediaUpload } from "@/components/admin/media-upload";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { adminClientFetch } from "@/lib/admin-client";
import type { ManagedSiteSettings } from "@/types/editorial";

const loadingImages = [
  { key: "loadingImage1Id", label: "تصویر اول لودر" },
  { key: "loadingImage2Id", label: "تصویر دوم لودر" },
  { key: "loadingImage3Id", label: "تصویر سوم لودر" },
] as const;
type LoadingImageKey = (typeof loadingImages)[number]["key"];
const parseMediaId = (value: string | undefined) => { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; };

export function LoadingSettingsForm({ initialSettings }: { initialSettings: ManagedSiteSettings }) {
  const links = initialSettings.socialLinks;
  const [imageIds, setImageIds] = useState<Record<LoadingImageKey, number | null>>(() => Object.fromEntries(loadingImages.map((image) => [image.key, parseMediaId(links[image.key])])) as Record<LoadingImageKey, number | null>);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const socialLinks = { ...links, loadingTitle: String(form.get("loadingTitle") ?? ""), loadingSubtitle: String(form.get("loadingSubtitle") ?? "") } as Record<string, string>;
    loadingImages.forEach((image) => { socialLinks[image.key] = imageIds[image.key] ? String(imageIds[image.key]) : ""; });
    const response = await adminClientFetch("/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteName: initialSettings.siteName, phone: initialSettings.phone, email: initialSettings.email, address: initialSettings.address, workingHours: initialSettings.workingHours, internalNote: initialSettings.internalNote, socialLinks }) }).catch(() => null);
    setSaving(false);
    setMessage(response?.ok ? "تنظیمات لودر ذخیره شد." : "ذخیره‌سازی ناموفق بود. اتصال سرور را بررسی کنید.");
  }

  return <form data-admin-save-form className="grid gap-6" onSubmit={save}>
    <fieldset className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-6"><legend className="px-2 text-xl font-black text-brand">متن فارسی لودر</legend><p className="text-sm leading-7 text-muted">این متن هنگام بارگذاری اولیه‌ی صفحات عمومی سایت نمایش داده می‌شود.</p><div className="grid gap-4 lg:grid-cols-2"><Input defaultValue={links.loadingTitle ?? "سفر شما در حال آماده شدن است"} id="loading-title" label="عنوان روی تصویر" maxLength={80} name="loadingTitle" /><Input defaultValue={links.loadingSubtitle ?? "جزئیات کوچک سفر، تجربه‌ای بزرگ می‌سازند."} id="loading-subtitle" label="متن زیر تصویر" maxLength={120} name="loadingSubtitle" /></div></fieldset>
    <fieldset className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-6"><legend className="px-2 text-xl font-black text-brand">تصاویر صفحه لودینگ</legend><p className="text-sm leading-7 text-muted">یک تا سه تصویر انتخاب کنید. اگر چند تصویر انتخاب شود، لودر آن‌ها را به‌صورت کوتاه و خودکار نمایش می‌دهد. تصویر عمودی یا مربعی بهترین نتیجه را می‌دهد.</p><div className="grid gap-5 md:grid-cols-3">{loadingImages.map((image) => <section className="rounded-2xl border border-border bg-background p-4" key={image.key}><MediaUpload aspect="wide" currentId={imageIds[image.key]} label={image.label} onRemoved={() => setImageIds((current) => ({ ...current, [image.key]: null }))} onUploaded={(id) => setImageIds((current) => ({ ...current, [image.key]: id }))} /></section>)}</div></fieldset>
    <div>{message ? <Alert variant={message.includes("ناموفق") ? "error" : "success"}>{message}</Alert> : null}<Button className="mt-4 w-full sm:w-auto" loading={saving} type="submit">ذخیره تنظیمات لودر</Button></div>
  </form>;
}
