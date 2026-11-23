import type { Metadata } from "next";

import { LocationIcon } from "@/components/layout/site-icons";
import { PageIntro } from "@/components/layout/page-intro";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { apiGet } from "@/lib/api/client";
import { toPersianDigits } from "@/lib/persian-number";

export const metadata: Metadata = {
  title: "تماس با ما",
  alternates: { canonical: "/contact/" },
};
type Settings = { siteName: string; phone: string | null; email: string | null; address: string | null; workingHours: string | null; socialLinks: Record<string, string> };
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
  const item = await apiGet<Settings>("/settings", { cache: "no-store" }).catch(() => null);
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

  return <><PageIntro title={`تماس با ${item?.siteName ?? "جهان باستان"}`} description="راه‌های تماس، ساعات پاسخ‌گویی و شبکه‌های اجتماعی." /><Container className="py-12"><div className="grid gap-5 md:grid-cols-2">
    <Card><h2 className="text-xl font-black">تلفن و ایمیل</h2>{item?.phone ? <a className="mt-4 block font-bold text-brand" dir="ltr" href={`tel:${item.phone}`}>{item.phone}</a> : null}{item?.email ? <a className="mt-3 block text-brand" dir="ltr" href={`mailto:${item.email}`}>{item.email}</a> : null}</Card>
    <Card><h2 className="text-xl font-black">آدرس دفتر</h2><p className="mt-4 whitespace-pre-line leading-8 text-muted">{item?.address || "آدرسی ثبت نشده است."}</p></Card>
    <Card><h2 className="text-xl font-black">ساعات کاری</h2><p className="mt-4 text-muted">{item?.workingHours ? toPersianDigits(item.workingHours) : "ساعات کاری ثبت نشده است."}</p></Card>
    <Card><h2 className="text-xl font-black">شبکه‌های اجتماعی</h2><div className="mt-4 flex flex-wrap gap-3">{Object.entries(socialLabels).map(([name, label]) => { const href = item?.socialLinks[name]; return href ? <a className="rounded-xl border border-border px-4 py-2 font-bold text-brand" href={href} key={name} rel="noreferrer" target="_blank">{label}</a> : null; })}</div></Card>
  </div>
  {mapEmbedUrl ? (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[0_18px_50px_rgba(1,37,105,.1)]" aria-labelledby="contact-map-title">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-bold text-brand">
            <LocationIcon className="size-5" />
            موقعیت روی نقشه
          </p>
          <h2 id="contact-map-title" className="mt-2 text-xl font-black sm:text-2xl">{mapTitle}</h2>
          {address ? <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{address}</p> : null}
        </div>
        {mapLinkUrl ? (
          <ButtonLink href={mapLinkUrl} target="_blank" rel="noreferrer" variant="accent" className="w-full shrink-0 !text-white hover:!text-white sm:w-auto">
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
        className="h-72 w-full border-0 sm:h-96"
      />
    </section>
  ) : null}
  </Container></>;
}
