import type { Metadata } from "next";

import { RichText } from "@/components/content/rich-text";
import { LocationIcon } from "@/components/layout/site-icons";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getPublicSettings } from "@/lib/api/public-settings";
import { toPersianDigits } from "@/lib/persian-number";

export const metadata: Metadata = {
  title: "درباره و تماس با ما",
  alternates: { canonical: "/contact/" },
};

const fallback = {
  eyebrow: "درباره جهان باستان",
  title: "همراه شما برای تجربه‌ای مطمئن از سفر",
  intro:
    "جهان باستان با شناخت مقصد، برنامه‌ریزی دقیق و پشتیبانی انسانی، مسیر سفر را برای شما روشن و قابل اعتماد می‌کند.",
  storyTitle: "داستان ما",
  storyBody:
    "ما سفر را فقط رزرو نمی‌کنیم؛ تجربه‌ای هماهنگ از انتخاب مقصد تا بازگشت می‌سازیم.",
  valuesTitle: "ارزش‌های ما",
  valuesBody:
    "شفافیت، پاسخ‌گویی، انتخاب آگاهانه و احترام به زمان و بودجه مسافر، پایه تصمیم‌های ما هستند.",
  trustTitle: "اعتماد و اعتبار",
  trustBody:
    "اطلاعات روشن، خدمات بررسی‌شده و پشتیبانی پیش و حین سفر، تعهد ما به یک تجربه مطمئن است.",
  ctaLabel: "مشاهده تورها",
  ctaHref: "/tours/",
};

function readValue(
  values: Record<string, string>,
  key: string,
  defaultValue: string,
): string {
  return values[key]?.trim() || defaultValue;
}

const socialLabels = {
  linkedin: "لینکدین",
  instagram: "اینستاگرام",
  telegram: "تلگرام",
  whatsapp: "واتساپ",
} as const;

const allowedMapHosts = [
  "google.com",
  "neshan.org",
  "balad.ir",
  "openstreetmap.org",
  "map.ir",
] as const;

const legacyOfficeMapEmbedUrl =
  "https://www.openstreetmap.org/export/embed.html?bbox=51.4121%2C35.7520%2C51.4321%2C35.7720&layer=mapnik&marker=35.7620%2C51.4221";
const legacyOfficeMapLinkUrl =
  "https://www.openstreetmap.org/?mlat=35.7620&mlon=51.4221#map=17/35.7620/51.4221";
const defaultOfficeMapEmbedUrl =
  "https://www.google.com/maps?q=Mirdamad%20Boulevard%2C%20between%20Modarres%20and%20Nelson%20Mandela%2C%20No.%20384%2C%20Tehran%2C%20Iran&output=embed";
const defaultOfficeMapLinkUrl =
  "https://www.google.com/maps/search/?api=1&query=Mirdamad%20Boulevard%2C%20between%20Modarres%20and%20Nelson%20Mandela%2C%20No.%20384%2C%20Tehran%2C%20Iran";

function safeHttpsUrl(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeMapEmbedUrl(value: string | undefined) {
  const safeUrl = safeHttpsUrl(value);
  if (!safeUrl) return null;
  const hostname = new URL(safeUrl).hostname.toLowerCase();
  const allowed = allowedMapHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
  return allowed ? safeUrl : null;
}

export default async function ContactPage() {
  const item = await getPublicSettings().catch(() => null);
  const values = item?.socialLinks ?? {};
  const sections = [
    {
      id: "story",
      title: readValue(values, "aboutStoryTitle", fallback.storyTitle),
      body: readValue(values, "aboutStoryBody", fallback.storyBody),
    },
    {
      id: "values",
      title: readValue(values, "aboutValuesTitle", fallback.valuesTitle),
      body: readValue(values, "aboutValuesBody", fallback.valuesBody),
    },
    {
      id: "trust",
      title: readValue(values, "aboutTrustTitle", fallback.trustTitle),
      body: readValue(values, "aboutTrustBody", fallback.trustBody),
    },
  ];
  const address = item?.address?.trim() ?? "";
  const mapTitle =
    item?.socialLinks.mapTitle?.trim() || "موقعیت دفتر جهان باستان";
  const configuredMapEmbedUrl = safeMapEmbedUrl(item?.socialLinks.mapEmbedUrl);
  const configuredMapLinkUrl = safeHttpsUrl(item?.socialLinks.mapLinkUrl);
  const mapEmbedUrl = configuredMapEmbedUrl && configuredMapEmbedUrl !== legacyOfficeMapEmbedUrl
    ? configuredMapEmbedUrl
    : defaultOfficeMapEmbedUrl;
  const mapLinkUrl = configuredMapLinkUrl && configuredMapLinkUrl !== legacyOfficeMapLinkUrl
    ? configuredMapLinkUrl
    : defaultOfficeMapLinkUrl;

  return (
    <Container className="grid gap-6 py-5 [--container-max:48rem] sm:gap-8 sm:py-7">
      <h1 className="text-lg font-black leading-tight text-brand sm:text-xl">
        درباره و تماس با {item?.siteName ?? "جهان باستان"}
      </h1>
      <section id="about" className="scroll-mt-24" aria-labelledby="about-title">
        <p className="text-sm font-bold text-brand">
          {readValue(values, "aboutEyebrow", fallback.eyebrow)}
        </p>
        <h2 id="about-title" className="mt-1 max-w-3xl text-lg font-black text-brand sm:text-xl">
          {readValue(values, "aboutTitle", fallback.title)}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          {readValue(values, "aboutIntro", fallback.intro)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ButtonLink href={readValue(values, "aboutCtaHref", fallback.ctaHref)} size="sm">
            {readValue(values, "aboutCtaLabel", fallback.ctaLabel)}
          </ButtonLink>
          <a className="text-sm font-bold text-brand underline underline-offset-4" href="#contact-details">
            راه‌های تماس
          </a>
        </div>

        <div className="mt-4 grid gap-3">
          {sections.map((section) => (
            <Card className="h-full" key={section.id}>
              <h3 className="text-base font-black text-brand">{section.title}</h3>
              <RichText
                allowImages={false}
                className="text-sm text-muted [&_p]:my-2 [&_p]:leading-6"
                content={section.body}
              />
            </Card>
          ))}
        </div>
      </section>

      <section id="contact-details" className="scroll-mt-24" aria-labelledby="contact-title">
        <h2 id="contact-title" className="mb-3 text-lg font-black text-brand sm:text-xl">تماس با ما</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <h3 className="text-base font-black">تلفن و ایمیل</h3>
            {item?.phone ? (
              <a className="mt-2 block text-right text-sm font-bold text-brand" dir="ltr" href={`tel:${item.phone}`}>{item.phone}</a>
            ) : null}
            {item?.email ? (
              <a className="mt-1 block text-right text-sm text-brand [overflow-wrap:anywhere]" dir="ltr" href={`mailto:${item.email}`}>{item.email}</a>
            ) : null}
          </Card>
          <Card>
            <h3 className="text-base font-black">آدرس دفتر</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{address || "آدرسی ثبت نشده است."}</p>
          </Card>
          <Card>
            <h3 className="text-base font-black">ساعات کاری</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item?.workingHours ? toPersianDigits(item.workingHours) : "ساعات کاری ثبت نشده است."}</p>
          </Card>
          <Card>
            <h3 className="text-base font-black">شبکه‌های اجتماعی</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(socialLabels).map(([name, label]) => {
                const href = values[name];
                return href ? (
                  <a className="inline-flex min-h-9 items-center rounded-lg border border-border px-2.5 text-sm font-bold text-brand" href={href} key={name} rel="noreferrer" target="_blank">{label}</a>
                ) : null;
              })}
            </div>
          </Card>
        </div>
        {mapEmbedUrl ? (
          <section className="mt-4 overflow-hidden rounded-xl border border-border bg-surface" aria-labelledby="contact-map-title">
            <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold text-brand">
                  <LocationIcon className="size-5" />
                  موقعیت روی نقشه
                </p>
                <h3 id="contact-map-title" className="mt-1 text-base font-black">{mapTitle}</h3>
                {address ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{address}</p> : null}
              </div>
              {mapLinkUrl ? (
                <ButtonLink href={mapLinkUrl} target="_blank" rel="noreferrer" variant="accent" size="sm" className="w-full shrink-0 !text-white hover:!text-white sm:w-auto">
                  بازکردن نقشه و مسیریابی
                </ButtonLink>
              ) : null}
            </div>
            <iframe
              title={mapTitle}
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="h-36 w-full border-0 sm:h-44"
            />
          </section>
        ) : null}
      </section>
    </Container>
  );
}
