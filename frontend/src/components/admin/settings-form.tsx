"use client";

import { homepageHeroAssets } from "@/lib/homepage-hero-assets";

import { type FormEvent, useState } from "react";

import styles from "./settings-form.module.css";

import { MediaUpload } from "@/components/admin/media-upload";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { InternalNoteField } from "@/components/admin/internal-note-field";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { communicationChannels } from "@/lib/communication-banners";
import { searchGuides } from "@/lib/search-guides";
import { defaultPaymentRules } from "@/lib/payment-rules";
import { siteConfig } from "@/config/site";
import { adminClientFetch } from "@/lib/admin-client";
import type { ManagedSiteSettings } from "@/types/editorial";

const footerServiceLinks =
  siteConfig.navigation.find((item) => item.href === "/services/")?.children ?? [];
const footerQuickLinks = siteConfig.footerLinks;

const heroServices = [
  { key: "heroTourBannerImageId", service: "tour", label: "تور" },
  { key: "heroVisaBannerImageId", service: "visa", label: "ویزا" },
  { key: "heroHotelBannerImageId", service: "hotel", label: "هتل" },
  { key: "heroFlightBannerImageId", service: "flight", label: "پرواز" },
  { key: "heroTrainBannerImageId", service: "train", label: "قطار" },
  { key: "heroBusBannerImageId", service: "bus", label: "اتوبوس" },
] as const;

type HeroImageKey = (typeof heroServices)[number]["key"];

function parseMediaId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const settingsSections = [{"key": "general", "label": "اطلاعات پایه", "description": "مشخصات مجموعه، ارتباط با مشتری و وضعیت فروش"}, {"key": "home", "label": "صفحه اصلی", "description": "تصاویر خدمات، بنر تبلیغاتی و ظاهر سایت"}, {"key": "guides", "label": "راهنمای خدمات", "description": "متن راهنمای جست‌وجو و صفحات بلیت"}, {"key": "about", "label": "درباره ما", "description": "معرفی مجموعه، داستان، ارزش‌ها و تصویر صفحه"}, {"key": "footer", "label": "فوتر و پیوندها", "description": "محتوای پایین سایت و لینک‌های دسترسی"}, {"key": "policies", "label": "قوانین و اعتماد", "description": "شرایط پرداخت و نشان‌های قابل استعلام"}] as const;

export function SettingsForm({ initialSettings }: { initialSettings: ManagedSiteSettings }) {
  const [activeSection, setActiveSection] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [communicationImages, setCommunicationImages] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(communicationChannels.map(({ key }) => [key, parseMediaId(initialSettings.socialLinks[`${key}BannerImageId`])])),
  );
  const [heroImageId, setHeroImageId] = useState<number | null>(() =>
    parseMediaId(initialSettings.socialLinks.heroBannerImageId),
  );
  const [aboutImageId, setAboutImageId] = useState<number | null>(() =>
    parseMediaId(initialSettings.socialLinks.aboutImageId),
  );
  const [homePromoImageId, setHomePromoImageId] = useState<number | null>(() =>
    parseMediaId(initialSettings.socialLinks.homePromoImageId),
  );
  const [footerAlertImageId, setFooterAlertImageId] = useState<number | null>(() =>
    parseMediaId(initialSettings.socialLinks.footerAlertImageId),
  );
  const [transportEmptyStateImageId, setTransportEmptyStateImageId] = useState<number | null>(() =>
    parseMediaId(initialSettings.socialLinks.transportEmptyStateImageId),
  );
  const [heroImageIds, setHeroImageIds] = useState<Record<HeroImageKey, number | null>>(
    () =>
      Object.fromEntries(
        heroServices.map(({ key }) => [key, parseMediaId(initialSettings.socialLinks[key])]),
      ) as Record<HeroImageKey, number | null>,
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await adminClientFetch("/admin/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteName: form.get("siteName"),
        phone: form.get("phone") || null,
        email: form.get("email") || null,
        address: form.get("address") || null,
        workingHours: form.get("workingHours") || null,
        internalNote: form.get("internalNote") || null,
        socialLinks: {
          ...initialSettings.socialLinks,
          ...Object.fromEntries(communicationChannels.flatMap(({ key }) => [
            [`${key}BannerImageId`, communicationImages[key] ? String(communicationImages[key]) : ""],
            [`${key}BannerTitle`, String(form.get(`${key}BannerTitle`) ?? "")],
            [`${key}BannerHref`, String(form.get(`${key}BannerHref`) ?? "")],
          ])),
          ...Object.fromEntries(searchGuides.map(({ key }) => [key, String(form.get(key) ?? "")])),
          paymentRulesBody: form.get("paymentRulesBody") || defaultPaymentRules,
          autumnThemeEnabled: form.get("autumnThemeEnabled") ? "true" : "false",
          onlineSalesEnabled: form.get("onlineSalesEnabled") ? "true" : "false",
          linkedin: form.get("linkedin") || "",
          telegram: form.get("telegram") || "",
          instagram: form.get("instagram") || "",
          whatsapp: form.get("whatsapp") || "",
          exchangeRateUsdIrt: initialSettings.socialLinks.exchangeRateUsdIrt ?? "",
          exchangeRateEurIrt: initialSettings.socialLinks.exchangeRateEurIrt ?? "",
          transportFlightGuide: form.get("transportFlightGuide") || "",
          transportTrainGuide: form.get("transportTrainGuide") || "",
          transportBusGuide: form.get("transportBusGuide") || "",
          transportEmptyStateImageId: transportEmptyStateImageId ? String(transportEmptyStateImageId) : "",
          aboutEyebrow: form.get("aboutEyebrow") || "",
          aboutTitle: form.get("aboutTitle") || "",
          aboutIntro: form.get("aboutIntro") || "",
          aboutStoryTitle: form.get("aboutStoryTitle") || "",
          aboutStoryBody: form.get("aboutStoryBody") || "",
          aboutValuesTitle: form.get("aboutValuesTitle") || "",
          aboutValuesBody: form.get("aboutValuesBody") || "",
          aboutTrustTitle: form.get("aboutTrustTitle") || "",
          aboutTrustBody: form.get("aboutTrustBody") || "",
          aboutCtaLabel: form.get("aboutCtaLabel") || "",
          aboutCtaHref: form.get("aboutCtaHref") || "",
          aboutImageId: aboutImageId ? String(aboutImageId) : "",
          heroBannerImageId: heroImageId ? String(heroImageId) : "",
          homePromoImageId: homePromoImageId ? String(homePromoImageId) : "",
          homePromoTitle: form.get("homePromoTitle") || "",
          homePromoHref: form.get("homePromoHref") || "",
          footerAlertImageId: footerAlertImageId ? String(footerAlertImageId) : "",
          ...Object.fromEntries(
            heroServices.map(({ key }) => [key, heroImageIds[key] ? String(heroImageIds[key]) : ""]),
          ),
          license1Title: form.get("license1Title") || "",
          license1Url: form.get("license1Url") || "",
          license2Title: form.get("license2Title") || "",
          license2Url: form.get("license2Url") || "",
          license3Title: form.get("license3Title") || "",
          license3Url: form.get("license3Url") || "",
          footerBrandTitle: form.get("footerBrandTitle") || "",
          footerDescription: form.get("footerDescription") || "",
          footerServicesTitle: form.get("footerServicesTitle") || "",
          footerQuickTitle: form.get("footerQuickTitle") || "",
          footerOfficeTitle: form.get("footerOfficeTitle") || "",
          footerCopyright: form.get("footerCopyright") || "",
          mapTitle: form.get("mapTitle") || "",
          mapEmbedUrl: form.get("mapEmbedUrl") || "",
          mapLinkUrl: form.get("mapLinkUrl") || "",
          ...Object.fromEntries(
            footerServiceLinks.flatMap((_, index) => [
              [`footerService${index + 1}Label`, form.get(`footerService${index + 1}Label`) || ""],
              [`footerService${index + 1}Url`, form.get(`footerService${index + 1}Url`) || ""],
            ]),
          ),
          ...Object.fromEntries(
            footerQuickLinks.flatMap((_, index) => [
              [`footerQuick${index + 1}Label`, form.get(`footerQuick${index + 1}Label`) || ""],
              [`footerQuick${index + 1}Url`, form.get(`footerQuick${index + 1}Url`) || ""],
            ]),
          ),
        },
      }),
    }).catch(() => null);
    setSaving(false);
    setMessage(response?.ok ? "تنظیمات با موفقیت ذخیره شد." : "ذخیره تنظیمات ناموفق بود.");
  }

  return (
    <form data-admin-save-form onSubmit={save} onInvalidCapture={(event) => {
      const group = (event.target as HTMLElement).closest<HTMLElement>("[data-settings-group]");
      if (group?.dataset.settingsGroup) setActiveSection(group.dataset.settingsGroup);
    }} className={styles.form}>
      <div className={styles.layout}>
        <nav className={styles.navigation} aria-label="بخش‌های تنظیمات سایت">
          <h2>تنظیمات سایت</h2>
          <p>بخش موردنظر را انتخاب کنید.</p>
          {settingsSections.map(({ key, label, description }) => <button type="button" key={key} aria-pressed={activeSection === key} aria-controls={`settings-${key}`} onClick={() => setActiveSection(key)}><strong>{label}</strong><span>{description}</span></button>)}
        </nav>
        <div className={styles.content}>
          <section id="settings-general" data-settings-group="general" hidden={activeSection !== "general"} className={styles.group} aria-labelledby="settings-general-title">
            <header className={styles.groupHeading}><h2 id="settings-general-title">اطلاعات پایه</h2><p>مشخصات مجموعه، ارتباط با مشتری و وضعیت فروش</p></header>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <legend className="px-2 text-xl font-black">اطلاعات عمومی</legend>
        <Input id="settings-name" name="siteName" label="نام سایت" defaultValue={initialSettings.siteName} required />
        <Input id="settings-phone" name="phone" label="شماره تماس" dir="ltr" defaultValue={initialSettings.phone ?? ""} />
        <Input id="settings-email" name="email" label="ایمیل" type="email" dir="ltr" defaultValue={initialSettings.email ?? ""} />
        <Textarea id="settings-address" name="address" label="آدرس دفتر" defaultValue={initialSettings.address ?? ""} />
        <Input id="settings-hours" name="workingHours" label="ساعات کاری" defaultValue={initialSettings.workingHours ?? ""} />
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <legend className="px-2 text-xl font-black">شبکه‌های اجتماعی</legend>
        <Input id="settings-linkedin" name="linkedin" label="لینکدین" dir="ltr" defaultValue={initialSettings.socialLinks.linkedin ?? ""} />
        <Input id="settings-telegram" name="telegram" label="تلگرام" dir="ltr" defaultValue={initialSettings.socialLinks.telegram ?? ""} />
        <Input id="settings-instagram" name="instagram" label="اینستاگرام" dir="ltr" defaultValue={initialSettings.socialLinks.instagram ?? ""} />
        <Input id="settings-whatsapp" name="whatsapp" label="واتساپ" dir="ltr" defaultValue={initialSettings.socialLinks.whatsapp ?? ""} />
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">نقشه صفحه تماس</legend>
        <p className="text-sm leading-7 text-muted">
          لینک Embed نقشه را از Google Maps، نشان، بلد، OpenStreetMap یا Map.ir
          وارد کنید. فقط نشانی URL را وارد کنید، نه کد کامل iframe. اگر این فیلد
          خالی باشد، نقشه به‌صورت خودکار از آدرس دفتر ساخته می‌شود.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Input
            id="settings-map-title"
            name="mapTitle"
            label="عنوان بخش نقشه"
            defaultValue={initialSettings.socialLinks.mapTitle ?? "موقعیت دفتر جهان باستان"}
          />
          <Input
            id="settings-map-link-url"
            name="mapLinkUrl"
            label="لینک بازکردن نقشه و مسیریابی"
            dir="ltr"
            type="url"
            placeholder="https://..."
            defaultValue={initialSettings.socialLinks.mapLinkUrl ?? "https://www.google.com/maps/search/?api=1&query=Mirdamad%20Boulevard%2C%20between%20Modarres%20and%20Nelson%20Mandela%2C%20No.%20384%2C%20Tehran%2C%20Iran"}
          />
        </div>
        <Input
          id="settings-map-embed-url"
          name="mapEmbedUrl"
          label="لینک Embed نقشه"
          hint="نمونه: https://www.google.com/maps/embed?pb=..."
          dir="ltr"
          type="url"
          placeholder="https://www.google.com/maps/embed?pb=..."
          defaultValue={initialSettings.socialLinks.mapEmbedUrl ?? "https://www.google.com/maps?q=Mirdamad%20Boulevard%2C%20between%20Modarres%20and%20Nelson%20Mandela%2C%20No.%20384%2C%20Tehran%2C%20Iran&output=embed"}
        />
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <legend className="px-2 text-xl font-black">فروش آنلاین</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-brand/40">
          <input
            className="mt-1 size-5 shrink-0 accent-brand"
            defaultChecked={initialSettings.socialLinks.onlineSalesEnabled === "true"}
            name="onlineSalesEnabled"
            type="checkbox"
          />
          <span>
            <strong className="block text-base">فعال‌سازی خرید و سبد خرید آنلاین</strong>
            <span className="mt-1 block text-sm leading-7 text-muted">
              با خاموش‌کردن این گزینه، افزودن به سبد و ثبت رزرو آنلاین متوقف و دکمهٔ سبد خرید از سربرگ پنهان می‌شود. اطلاعات و سفارش‌های قبلی حذف نمی‌شوند.
            </span>
          </span>
        </label>
      </fieldset>
          </section>
          <section id="settings-home" data-settings-group="home" hidden={activeSection !== "home"} className={styles.group} aria-labelledby="settings-home-title">
            <header className={styles.groupHeading}><h2 id="settings-home-title">صفحه اصلی</h2><p>تصاویر خدمات، بنر تبلیغاتی و ظاهر سایت</p></header>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">بنرهای ارتباطی صفحه اصلی</legend>
        <p className="text-sm leading-7 text-muted">این بنرها جایگزین مقاصد محبوب هستند و به ترتیب اینستاگرام، تلگرام، اپلیکیشن و واتساپ در یک ردیف و به‌صورت مربع کنار هم نمایش داده می‌شوند. برای نمایش هر بنر، تصویر و لینک آن را وارد کنید. با حذف تصویر، بنر مخفی می‌شود. تصویر مربع با اندازه پیشنهادی ۶۰۰ در ۶۰۰ پیکسل بارگذاری کنید. متن و نشان را در مرکز قرار دهید.</p>
        {communicationChannels.map(({ key, label }) => (
          <section key={key} className="space-y-4 rounded-2xl border border-border bg-background p-4">
            <h3 className="font-black">بنر {label}</h3>
            <Input id={`${key}-banner-title`} name={`${key}BannerTitle`} label="عنوان و متن جایگزین تصویر" defaultValue={initialSettings.socialLinks[`${key}BannerTitle`] ?? label} maxLength={100} />
            <Input id={`${key}-banner-href`} name={`${key}BannerHref`} label="لینک مقصد بنر" dir="ltr" placeholder="https://..." pattern="https?://.+|/.*" defaultValue={initialSettings.socialLinks[`${key}BannerHref`] ?? initialSettings.socialLinks[key] ?? ""} />
            <MediaUpload currentId={communicationImages[key]} label={`تصویر بنر ${label}`} aspect="square" onUploaded={(id) => setCommunicationImages((current) => ({ ...current, [key]: id }))} onRemoved={() => setCommunicationImages((current) => ({ ...current, [key]: null }))} />
          </section>
        ))}
      </fieldset>
      <fieldset className="space-y-5 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">تصاویر هیرو برای فیلتر خدمات</legend>
        <p className="text-sm leading-7 text-muted">
          برای هر تب فیلتر یک تصویر افقی بارگذاری کنید. با کلیک کاربر روی تور، ویزا،
          هتل، پرواز، قطار یا اتوبوس، تصویر همان خدمت در هیرو نمایش داده می‌شود.
          تصاویر جدید به‌صورت پیش‌فرض فعال‌اند؛ بارگذاری تصویر اختصاصی، تصویر همان بخش را جایگزین می‌کند. در صورت حذف تصویر اختصاصی، تصویر پیش‌فرض دوباره نمایش داده می‌شود.
        </p>
        <div className="rounded-2xl border border-dashed border-border p-4">
          <h3 className="mb-3 text-sm font-black">تصویر عمومی و جایگزین</h3>
          <MediaUpload
            currentId={heroImageId}
            label="تصویر عمومی هیرو صفحه خانه"
            aspect="wide"
            onUploaded={setHeroImageId}
            onRemoved={() => setHeroImageId(null)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {heroServices.map(({ key, label, service }) => (
            <section key={key} className="rounded-2xl border border-border bg-background p-4">
              <h3 className="mb-3 text-sm font-black">تصویر هیرو {label}</h3>
              <MediaUpload
                currentId={heroImageIds[key]}
                fallbackUrl={homepageHeroAssets[service]}
                label={`تصویر هیرو ${label}`}
                aspect="wide"
                onUploaded={(id) =>
                  setHeroImageIds((current) => ({ ...current, [key]: id }))
                }
                onRemoved={() =>
                  setHeroImageIds((current) => ({
                    ...current,
                    [key]: null,
                  }))
                }
              />
            </section>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">بنر تبلیغاتی پایین فیلتر صفحه اصلی</legend>
        <p className="text-sm leading-7 text-muted">
          این بنر زیر چهار مزیت پایین فیلتر صفحه اصلی نمایش داده می‌شود. تصویر افقی بارگذاری کنید، عنوان و مسیر مقصد را وارد کنید؛ برای نمونه می‌توانید آن را به تورهای تابستان ۱۴۰۵ وصل کنید.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="settings-home-promo-title"
            name="homePromoTitle"
            label="عنوان روی بنر"
            defaultValue={initialSettings.socialLinks.homePromoTitle ?? ""}
            placeholder="مثلاً تورهای تابستان ۱۴۰۵"
            maxLength={100}
          />
          <Input
            id="settings-home-promo-href"
            name="homePromoHref"
            label="مسیر کلیک بنر"
            dir="ltr"
            defaultValue={initialSettings.socialLinks.homePromoHref ?? "/tours/"}
            placeholder="/tours/?departureFrom=2026-06-22&departureTo=2026-09-22"
            pattern="/[a-zA-Z0-9/?=&_%-]*"
          />
        </div>
        <MediaUpload
          currentId={homePromoImageId}
          label="تصویر افقی بنر تبلیغاتی"
          aspect="wide"
          onRemoved={() => setHomePromoImageId(null)}
          onUploaded={setHomePromoImageId}
        />
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <legend className="px-2 text-xl font-black">ظاهر فصلی سایت</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-brand/40">
          <input
            className="mt-1 size-5 shrink-0 accent-[#b85c2b]"
            defaultChecked={initialSettings.socialLinks.autumnThemeEnabled === "true"}
            name="autumnThemeEnabled"
            type="checkbox"
          />
          <span>
            <strong className="block text-base">فعال‌سازی تم پاییزی</strong>
            <span className="mt-1 block text-sm leading-7 text-muted">
              رنگ و سایهٔ گرم، برگ‌های ظریف کنار سکشن‌ها و حرکت آرام برگ‌ها در بالای صفحات عمومی را فعال می‌کند. حرکت در موبایل و حالت کاهش حرکت نمایش داده نمی‌شود.
            </span>
          </span>
        </label>
      </fieldset>
          </section>
          <section id="settings-guides" data-settings-group="guides" hidden={activeSection !== "guides"} className={styles.group} aria-labelledby="settings-guides-title">
            <header className={styles.groupHeading}><h2 id="settings-guides-title">راهنمای خدمات</h2><p>متن راهنمای جست‌وجو و صفحات بلیت</p></header>
      <fieldset className="space-y-5 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">صفحه‌های راهنمای خدمات جست‌وجو</legend>
        <p className="text-sm leading-7 text-muted">با انتخاب هر خدمت در جست‌وجوی صفحه اصلی، متن مربوط زیر بنرهای ارتباطی نمایش داده می‌شود. برای مخفی کردن یک راهنما، متن آن را خالی کنید.</p>
        {searchGuides.map(({ key, label, text }) => <details className={styles.guide} key={key}><summary>صفحه راهنمایی {label}</summary><div className="p-4"><RichTextEditor name={key} label={`صفحه راهنمایی ${label}`} defaultValue={initialSettings.socialLinks[key] ?? text} rows={12} /></div></details>)}
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">راهنمای صفحات بلیت</legend>
        <p className="text-sm leading-7 text-muted">این متن‌ها در پایین فهرست نتایج همان وسیلهٔ نقلیه نمایش داده می‌شوند. برای جدا کردن پاراگراف‌ها یک خط خالی بگذارید.</p>
        <MediaUpload currentId={transportEmptyStateImageId} label="آیکن نبود بلیت" onUploaded={setTransportEmptyStateImageId} onRemoved={() => setTransportEmptyStateImageId(null)} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Textarea defaultValue={initialSettings.socialLinks.transportFlightGuide ?? ""} id="settings-transport-flight-guide" label="راهنمای پرواز" name="transportFlightGuide" rows={6} />
          <Textarea defaultValue={initialSettings.socialLinks.transportTrainGuide ?? ""} id="settings-transport-train-guide" label="راهنمای قطار" name="transportTrainGuide" rows={6} />
          <Textarea defaultValue={initialSettings.socialLinks.transportBusGuide ?? ""} id="settings-transport-bus-guide" label="راهنمای اتوبوس" name="transportBusGuide" rows={6} />
        </div>
      </fieldset>
          </section>
          <section id="settings-about" data-settings-group="about" hidden={activeSection !== "about"} className={styles.group} aria-labelledby="settings-about-title">
            <header className={styles.groupHeading}><h2 id="settings-about-title">درباره ما</h2><p>معرفی مجموعه، داستان، ارزش‌ها و تصویر صفحه</p></header>
      <fieldset className="space-y-5 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">محتوای صفحه درباره ما</legend>
        <p className="text-sm leading-7 text-muted">
          تمام متن‌ها و تصویر این بخش مستقیماً در صفحه عمومی درباره ما نمایش داده می‌شوند.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="settings-about-eyebrow"
            name="aboutEyebrow"
            label="برچسب بالای صفحه"
            defaultValue={initialSettings.socialLinks.aboutEyebrow ?? "درباره جهان باستان"}
            maxLength={80}
          />
          <Input
            id="settings-about-title"
            name="aboutTitle"
            label="عنوان اصلی"
            defaultValue={initialSettings.socialLinks.aboutTitle ?? "همراه شما برای تجربه‌ای مطمئن از سفر"}
            maxLength={160}
          />
        </div>
        <Textarea
          id="settings-about-intro"
          name="aboutIntro"
          label="متن معرفی کوتاه"
          defaultValue={initialSettings.socialLinks.aboutIntro ?? "جهان باستان با شناخت مقصد، برنامه‌ریزی دقیق و پشتیبانی انسانی، مسیر سفر را برای شما روشن و قابل اعتماد می‌کند."}
          maxLength={500}
        />
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="space-y-3 rounded-xl border border-border p-4">
            <Input
              id="settings-about-story-title"
              name="aboutStoryTitle"
              label="عنوان داستان ما"
              defaultValue={initialSettings.socialLinks.aboutStoryTitle ?? "داستان ما"}
              maxLength={100}
            />
            <RichTextEditor
              defaultValue={initialSettings.socialLinks.aboutStoryBody ?? "ما سفر را فقط رزرو نمی‌کنیم؛ تجربه‌ای هماهنگ از انتخاب مقصد تا بازگشت می‌سازیم."}
              label="متن داستان ما"
              name="aboutStoryBody"
              rows={6}
            />
          </section>
          <section className="space-y-3 rounded-xl border border-border p-4">
            <Input
              id="settings-about-values-title"
              name="aboutValuesTitle"
              label="عنوان ارزش‌ها"
              defaultValue={initialSettings.socialLinks.aboutValuesTitle ?? "ارزش‌های ما"}
              maxLength={100}
            />
            <RichTextEditor
              defaultValue={initialSettings.socialLinks.aboutValuesBody ?? "شفافیت، پاسخ‌گویی، انتخاب آگاهانه و احترام به زمان و بودجه مسافر، پایه تصمیم‌های ما هستند."}
              label="متن ارزش‌ها"
              name="aboutValuesBody"
              rows={6}
            />
          </section>
          <section className="space-y-3 rounded-xl border border-border p-4">
            <Input
              id="settings-about-trust-title"
              name="aboutTrustTitle"
              label="عنوان اعتماد و اعتبار"
              defaultValue={initialSettings.socialLinks.aboutTrustTitle ?? "اعتماد و اعتبار"}
              maxLength={100}
            />
            <RichTextEditor
              defaultValue={initialSettings.socialLinks.aboutTrustBody ?? "اطلاعات روشن، خدمات بررسی‌شده و پشتیبانی پیش و حین سفر، تعهد ما به یک تجربه مطمئن است."}
              label="متن اعتماد و اعتبار"
              name="aboutTrustBody"
              rows={6}
            />
          </section>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="settings-about-cta-label" name="aboutCtaLabel" label="متن دکمه اقدام" defaultValue={initialSettings.socialLinks.aboutCtaLabel ?? "مشاهده تورها"} maxLength={60} />
          <Input id="settings-about-cta-href" name="aboutCtaHref" label="مسیر داخلی دکمه" dir="ltr" defaultValue={initialSettings.socialLinks.aboutCtaHref ?? "/tours/"} pattern="/[a-zA-Z0-9/_-]*" />
        </div>
        <MediaUpload
          currentId={aboutImageId}
          label="تصویر صفحه درباره ما"
          aspect="wide"
          onRemoved={() => setAboutImageId(null)}
          onUploaded={setAboutImageId}
        />
      </fieldset>
          </section>
          <section id="settings-footer" data-settings-group="footer" hidden={activeSection !== "footer"} className={styles.group} aria-labelledby="settings-footer-title">
            <header className={styles.groupHeading}><h2 id="settings-footer-title">فوتر و پیوندها</h2><p>محتوای پایین سایت و لینک‌های دسترسی</p></header>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">محتوای فوتر</legend>
        <p className="text-sm leading-7 text-muted">
          تیترها، معرفی برند و متن نوار پایانی فوتر را ویرایش کنید.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="settings-footer-brand-title" name="footerBrandTitle" label="عنوان برند در فوتر" defaultValue={initialSettings.socialLinks.footerBrandTitle ?? initialSettings.siteName} />
          <Input id="settings-footer-office-title" name="footerOfficeTitle" label="عنوان ستون دفتر" defaultValue={initialSettings.socialLinks.footerOfficeTitle ?? `دفتر ${initialSettings.siteName}`} />
          <Input id="settings-footer-services-title" name="footerServicesTitle" label="عنوان ستون خدمات" defaultValue={initialSettings.socialLinks.footerServicesTitle ?? "خدمات سفر"} />
          <Input id="settings-footer-quick-title" name="footerQuickTitle" label="عنوان ستون دسترسی سریع" defaultValue={initialSettings.socialLinks.footerQuickTitle ?? "دسترسی سریع"} />
        </div>
        <Textarea id="settings-footer-description" name="footerDescription" label="توضیح کوتاه برند" defaultValue={initialSettings.socialLinks.footerDescription ?? "پکیج‌های گردشگری، راهنمای مقصد و خدمات سفر برای برنامه‌ریزی یک تجربه مطمئن و آگاهانه."} />
        <MediaUpload
          currentId={footerAlertImageId}
          label="تصویر اعلان پیامکی فوتر"
          aspect="wide"
          onRemoved={() => setFooterAlertImageId(null)}
          onUploaded={setFooterAlertImageId}
        />
        <Input id="settings-footer-copyright" name="footerCopyright" label="متن کپی‌رایت" defaultValue={initialSettings.socialLinks.footerCopyright ?? `© ${new Date().getFullYear().toLocaleString("fa-IR")} ${initialSettings.siteName}. تمامی حقوق محفوظ است.`} />
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <legend className="px-2 text-xl font-black">لینک‌های خدمات سفر</legend>
        {footerServiceLinks.map((item, index) => (
          <div className="grid gap-3 sm:grid-cols-2" key={item.href}>
            <Input id={`settings-footer-service-${index + 1}-label`} name={`footerService${index + 1}Label`} label={`عنوان خدمت ${(index + 1).toLocaleString("fa-IR")}`} defaultValue={initialSettings.socialLinks[`footerService${index + 1}Label`] ?? item.label} />
            <Input id={`settings-footer-service-${index + 1}-url`} name={`footerService${index + 1}Url`} label="مسیر داخلی" dir="ltr" defaultValue={initialSettings.socialLinks[`footerService${index + 1}Url`] ?? item.href} />
          </div>
        ))}
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <legend className="px-2 text-xl font-black">لینک‌های دسترسی سریع</legend>
        {footerQuickLinks.map((item, index) => (
          <div className="grid gap-3 sm:grid-cols-2" key={item.href}>
            <Input id={`settings-footer-quick-${index + 1}-label`} name={`footerQuick${index + 1}Label`} label={`عنوان لینک ${(index + 1).toLocaleString("fa-IR")}`} defaultValue={initialSettings.socialLinks[`footerQuick${index + 1}Label`] ?? item.label} />
            <Input id={`settings-footer-quick-${index + 1}-url`} name={`footerQuick${index + 1}Url`} label="مسیر داخلی" dir="ltr" defaultValue={initialSettings.socialLinks[`footerQuick${index + 1}Url`] ?? item.href} />
          </div>
        ))}
      </fieldset>
          </section>
          <section id="settings-policies" data-settings-group="policies" hidden={activeSection !== "policies"} className={styles.group} aria-labelledby="settings-policies-title">
            <header className={styles.groupHeading}><h2 id="settings-policies-title">قوانین و اعتماد</h2><p>شرایط پرداخت و نشان‌های قابل استعلام</p></header>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">قوانین پرداخت و استرداد</legend>
        <p className="text-sm text-muted">متن صفحه قوانین پرداخت برای هتل، بلیت و تور را اینجا ویرایش کنید.</p>
        <RichTextEditor name="paymentRulesBody" label="متن قوانین پرداخت و استرداد" defaultValue={initialSettings.socialLinks.paymentRulesBody || defaultPaymentRules} rows={18} />
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
        <legend className="px-2 text-xl font-black">مجوزها و نشان‌های اعتماد</legend>
        <p className="text-sm leading-7 text-muted">فقط مجوزهای واقعی را همراه لینک صفحه استعلام رسمی وارد کنید.</p>
        {[1, 2, 3].map((number) => (
          <div className="grid gap-3 sm:grid-cols-2" key={number}>
            <Input id={`settings-license-${number}-title`} name={`license${number}Title`} label={`عنوان مجوز ${number.toLocaleString("fa-IR")}`} defaultValue={initialSettings.socialLinks[`license${number}Title`] ?? ""} />
            <Input id={`settings-license-${number}-url`} name={`license${number}Url`} label={`لینک استعلام مجوز ${number.toLocaleString("fa-IR")}`} dir="ltr" type="url" defaultValue={initialSettings.socialLinks[`license${number}Url`] ?? ""} />
          </div>
        ))}
      </fieldset>
          </section>
        </div>
      </div>
      <div className={styles.notes}><InternalNoteField defaultValue={initialSettings.internalNote} /></div>
      <div className={styles.saveBar}>
        <p role="status">{message || "پس از ویرایش بخش‌های موردنظر، تغییرات را ذخیره کنید."}</p>
        <Button type="submit" loading={saving}>ذخیره تنظیمات</Button>
      </div>
    </form>
  );
}
