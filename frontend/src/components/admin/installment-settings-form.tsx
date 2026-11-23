"use client";

import { type FormEvent, useState } from "react";

import { MediaUpload } from "@/components/admin/media-upload";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { adminClientFetch } from "@/lib/admin-client";
import type { ManagedSiteSettings } from "@/types/editorial";

const services = [
  { key: "Tour", label: "تور", description: "داخلی و خارجی", icon: "✦" },
  { key: "Hotel", label: "هتل", description: "داخلی و خارجی", icon: "▥" },
  { key: "Flight", label: "بلیط", description: "پرواز داخلی و خارجی", icon: "✈" },
  { key: "Visa", label: "ویزا", description: "توریستی و کاری", icon: "▧" },
  { key: "Package", label: "پکیج سفر", description: "سفر ترکیبی و گروهی", icon: "✧" },
] as const;

const parseMediaId = (value: string | undefined) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export function InstallmentSettingsForm({ initialSettings }: { initialSettings: ManagedSiteSettings }) {
  const initialLinks = initialSettings.socialLinks;
  const [bannerId, setBannerId] = useState<number | null>(() => parseMediaId(initialLinks.installmentBannerImageId));
  const [enabledServices, setEnabledServices] = useState<Record<string, boolean>>(() => Object.fromEntries(services.map((service) => [service.key, initialLinks["installmentService" + service.key] !== "false"])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const configuredMinimumDownPayment = Math.min(100, Math.max(50, Number(form.get("installmentMinDownPaymentPercent")) || 50));
    const configuredDefaultDownPayment = Math.min(100, Math.max(configuredMinimumDownPayment, Number(form.get("installmentDownPaymentPercent")) || configuredMinimumDownPayment));
    const socialLinks: Record<string, string> = {
      ...initialLinks,
      installmentBannerImageId: bannerId ? String(bannerId) : "",
      installmentTitle: String(form.get("installmentTitle") ?? ""),
      installmentIntro: String(form.get("installmentIntro") ?? ""),
      installmentDefaultAmount: String(form.get("installmentDefaultAmount") ?? ""),
      installmentMinDownPaymentPercent: String(configuredMinimumDownPayment),
      installmentDownPaymentPercent: String(configuredDefaultDownPayment),
      installmentMaxMonths: String(form.get("installmentMaxMonths") ?? ""),
      installmentFeeRate: String(form.get("installmentFeeRate") ?? ""),
      installmentMaxFeeRate: String(form.get("installmentMaxFeeRate") ?? ""),
      installmentContactHref: String(form.get("installmentContactHref") ?? "/contact/"),
    };
    services.forEach((service) => { socialLinks["installmentService" + service.key] = String(enabledServices[service.key]); });
    const response = await adminClientFetch("/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteName: initialSettings.siteName, phone: initialSettings.phone, email: initialSettings.email, address: initialSettings.address, workingHours: initialSettings.workingHours, internalNote: initialSettings.internalNote, socialLinks }) }).catch(() => null);
    setSaving(false);
    setMessage(response?.ok ? "تنظیمات اقساط ذخیره شد و در صفحه عمومی اعمال می‌شود." : "ذخیره‌سازی ناموفق بود. اتصال سرور را بررسی کنید.");
  }

  return <form data-admin-save-form className="grid gap-6" onSubmit={save}>
    <fieldset className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-6"><legend className="px-2 text-xl font-black text-brand">بنر و معرفی صفحه</legend><p className="text-sm leading-7 text-muted">تصویر انتخاب‌شده با پوشش کامل پشت عنوان صفحه عمومی نمایش داده می‌شود.</p><div className="grid gap-4 lg:grid-cols-2"><Input defaultValue={initialLinks.installmentTitle ?? "خرید اقساطی سفر"} id="installment-title" label="عنوان صفحه" maxLength={100} name="installmentTitle" /><Input defaultValue={initialLinks.installmentContactHref ?? "/contact/"} dir="ltr" id="installment-contact" label="مسیر دریافت مشاوره" name="installmentContactHref" pattern="/[a-zA-Z0-9/_?-]*" /></div><Textarea defaultValue={initialLinks.installmentIntro ?? "با شرایط اقساطی منعطف، سفر بعدی‌تان را آسان‌تر برنامه‌ریزی کنید."} id="installment-intro" label="متن معرفی" maxLength={500} name="installmentIntro" rows={4} /><MediaUpload aspect="wide" currentId={bannerId} label="بنر صفحه اقساط" onRemoved={() => setBannerId(null)} onUploaded={setBannerId} /></fieldset>

    <fieldset className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-6"><legend className="px-2 text-xl font-black text-brand">مدیریت خدمات قابل پرداخت اقساطی</legend><p className="text-sm leading-7 text-muted">هر مورد فعال، در بخش خدمات صفحه خرید اقساطی نمایش داده می‌شود. برای نمایش یک تور در پایین همان صفحه، تیک «قابل خرید اقساطی» را در فرم هر تور نیز فعال کنید.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{services.map((service) => { const enabled = enabledServices[service.key]; return <button aria-pressed={enabled} className={"flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition " + (enabled ? "border-accent-strong bg-[#fff1f7]" : "border-border bg-white text-muted")} key={service.key} onClick={() => setEnabledServices((current) => ({ ...current, [service.key]: !current[service.key] }))} type="button"><span><strong className="block text-sm text-brand">{service.label}</strong><span className="mt-1 block text-xs">{service.description}</span></span><span className={"grid size-8 place-items-center rounded-full text-sm font-black " + (enabled ? "bg-accent-strong text-white" : "bg-surface-muted text-muted")}>{enabled ? "✓" : service.icon}</span></button>; })}</div></fieldset>

    <fieldset className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-6"><legend className="px-2 text-xl font-black text-brand">تنظیمات محاسبه اقساط</legend><p className="rounded-2xl bg-[#fff1f7] px-4 py-3 text-sm leading-7 text-brand">فرمول: مبلغ کل − پیش‌پرداخت = مانده بدهی؛ سپس مانده بدهی × تعداد ماه × کارمزد ماهانه، به مانده بدهی اضافه و بر تعداد چک‌ها تقسیم می‌شود.</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Input defaultValue={initialLinks.installmentDefaultAmount ?? "120000000"} id="installment-amount" label="مبلغ پیش‌فرض (تومان)" min="0" name="installmentDefaultAmount" type="number" /><Input defaultValue={String(Math.min(100, Math.max(50, Number(initialLinks.installmentMinDownPaymentPercent) || 50)))} id="installment-min-down-payment" label="حداقل پیش‌پرداخت (درصد)" max="100" min="50" name="installmentMinDownPaymentPercent" type="number" /><Input defaultValue={String(Math.min(100, Math.max(50, Number(initialLinks.installmentDownPaymentPercent) || 50)))} id="installment-down-payment" label="پیش‌پرداخت پیش‌فرض (درصد)" max="100" min="50" name="installmentDownPaymentPercent" type="number" /><Input defaultValue={initialLinks.installmentMaxMonths ?? "12"} id="installment-max-months" label="حداکثر طرح اقساطی (ماه)" max="12" min="3" name="installmentMaxMonths" type="number" /><Input defaultValue={initialLinks.installmentFeeRate ?? "5"} id="installment-fee" label="کارمزد ماهانه پیش‌فرض (درصد)" max="100" min="0" name="installmentFeeRate" type="number" /><Input defaultValue={initialLinks.installmentMaxFeeRate ?? "24"} id="installment-max-fee" label="حداکثر کارمزد ماهانه (درصد)" max="100" min="0" name="installmentMaxFeeRate" type="number" /></div></fieldset>

    <div>{message ? <Alert variant={message.includes("ناموفق") ? "error" : "success"}>{message}</Alert> : null}<Button className="mt-4 w-full sm:w-auto" loading={saving} type="submit">ذخیره تغییرات اقساط</Button></div>
  </form>;
}
