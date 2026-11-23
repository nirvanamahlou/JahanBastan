import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { TourListingCard } from "@/components/content/tour-listing-card";
import { InstallmentCalculator } from "@/components/installments/installment-calculator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { createCountryImageMap, normalizeCountryName } from "@/lib/country-name";
import { toToman, type ExchangeRates } from "@/lib/currency-conversion";
import { formatPersianDate } from "@/lib/persian-date";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "خرید اقساطی",
  description: "محاسبه اقساط و مشاهده تورهای قابل خرید اقساطی جهان باستان.",
  alternates: { canonical: "/installments/" },
};

type Settings = { socialLinks: Record<string, string> };
type Tour = { id: number; slug: string; title: string; durationDays: number | null; departureDate: string | null; priceAmount: string | null; currency: string | null; transportation: string | null; summary: string | null; imageId: number | null; isFeatured: boolean; destination: { title: string; country: string } | null };
type Country = { name: string; imageId: number | null };
type StepIconName = "wallet" | "calculator" | "calendar" | "check" | "shield" | "chart";

function InstallmentStepIcon({ name }: { name: StepIconName }) {
  const props = {
    "aria-hidden": true,
    className: "size-8",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (name === "wallet") return <svg {...props}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2H6a2 2 0 0 0 0 4h14v4a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M20 9H6a2 2 0 0 0 0 4h14V9Z" /><circle cx="16.5" cy="11" r=".8" fill="currentColor" /></svg>;
  if (name === "calculator") return <svg {...props}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 6.5h8M8 11h1M12 11h1M16 11h.01M8 15h1M12 15h1M16 15h.01M8 18h1M12 18h1M16 18h.01" /></svg>;
  if (name === "calendar") return <svg {...props}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></svg>;
  if (name === "check") return <svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.3 2.3 4.8-5" /><path d="M18.2 5.8 20 4" /></svg>;
  if (name === "shield") return <svg {...props}><path d="M12 3 19 6v5c0 4.5-2.8 7.6-7 10-4.2-2.4-7-5.5-7-10V6l7-3Z" /><path d="m8.5 12 2.2 2.2 4.7-4.8" /></svg>;
  return <svg {...props}><path d="M4 19V10M10 19V6M16 19v-4M22 19H2" /><path d="m14 8 3-3 3 3M17 5v8" /></svg>;
}

const steps: Array<{ number: string; icon: StepIconName; iconClass: string; title: string; text: string }> = [
  { number: "۱", icon: "wallet", iconClass: "bg-rose-100 text-rose-600 ring-rose-100", title: "پیش‌پرداخت", text: "مبلغ پیش‌پرداخت از مبلغ کل خرید کسر می‌شود." },
  { number: "۲", icon: "calculator", iconClass: "bg-sky-100 text-sky-600 ring-sky-100", title: "محاسبه مبلغ اقساط", text: "مانده بدهی × تعداد ماه × نرخ کارمزد ماهانه محاسبه می‌شود." },
  { number: "۳", icon: "calendar", iconClass: "bg-violet-100 text-violet-600 ring-violet-100", title: "پرداخت ماهانه", text: "مبلغ حاصل بر تعداد چک‌های انتخاب‌شده تقسیم می‌شود." },
  { number: "۴", icon: "check", iconClass: "bg-cyan-100 text-cyan-700 ring-cyan-100", title: "اعتبارسنجی چک", text: "اعتبار صادرکننده چک پیش از تأیید نهایی بررسی می‌شود." },
  { number: "۵", icon: "shield", iconClass: "bg-emerald-100 text-emerald-600 ring-emerald-100", title: "چک ضمانت", text: "شرایط چک ضمانت متناسب با پرونده اعلام می‌شود." },
  { number: "۶", icon: "chart", iconClass: "bg-amber-100 text-amber-600 ring-amber-100", title: "سقف اعتبار", text: "سقف خرید اقساطی پس از بررسی کد ملی تعیین می‌شود." },
];
const serviceOptions = [
  { key: "tour", icon: "✦", title: "تور", description: "داخلی و خارجی" },
  { key: "hotel", icon: "▥", title: "هتل", description: "داخلی و خارجی" },
  { key: "flight", icon: "✈", title: "بلیط", description: "پرواز داخلی و خارجی" },
  { key: "visa", icon: "▧", title: "ویزا", description: "توریستی و کاری" },
  { key: "package", icon: "✧", title: "پکیج سفر", description: "ترکیبی و گروهی" },
];
const numeric = (value: string | undefined, fallback: number) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback; };
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export default async function InstallmentsPage() {
  const [settings, tours, countryPayload] = await Promise.all([apiGet<Settings>("/settings", { cache: "no-store" }).catch((): Settings => ({ socialLinks: {} })), apiGet<{ items: Tour[] }>("/tours?installmentOnly=true&pageSize=24", { cache: "no-store" }).catch(() => ({ items: [] })), apiGet<{ items: Country[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] }))]);
  const countryFlagImageIds = createCountryImageMap(countryPayload.items);
  const links: Record<string, string> = settings.socialLinks;
  const exchangeRates: ExchangeRates = { usdToIrt: settings.socialLinks.exchangeRateUsdIrt, eurToIrt: settings.socialLinks.exchangeRateEurIrt };
  const bannerId = numeric(links.installmentBannerImageId, 0) || null;
  const title = links.installmentTitle?.trim() || "خرید اقساطی سفر";
  const intro = links.installmentIntro?.trim() || "با شرایط اقساطی منعطف، سفر بعدی‌تان را آسان‌تر برنامه‌ریزی کنید.";
  const contactHref = links.installmentContactHref?.startsWith("/") ? links.installmentContactHref : "/contact/";
  const minimumDownPaymentPercent = clamp(numeric(links.installmentMinDownPaymentPercent, 50), 50, 100);
  const maximumMonths = clamp(Math.round(numeric(links.installmentMaxMonths, 12)), 3, 12);
  const maximumFeeRate = clamp(numeric(links.installmentMaxFeeRate, 24), 0, 100);
  const defaultFeeRate = clamp(numeric(links.installmentFeeRate, 5), 0, maximumFeeRate);
  const enabledServices = serviceOptions.filter((service) => links["installmentService" + service.key.charAt(0).toUpperCase() + service.key.slice(1)] !== "false");
  const toursEnabled = enabledServices.some((service) => service.key === "tour");

  return <>
    <section className="relative isolate min-h-[330px] overflow-hidden bg-brand text-white sm:min-h-[400px]">
      {bannerId ? <Image alt="" className="object-cover" fill priority sizes="100vw" src={PUBLIC_API_BASE_URL + "/media/" + bannerId} /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,#eb5d9f_0,transparent_24%),radial-gradient(circle_at_82%_72%,#94a3b8_0,transparent_38%)]" />}
      <div className="absolute inset-0 bg-gradient-to-l from-black/45 via-black/20 to-transparent" />
      <Container className="relative py-14 sm:py-20"><Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "خرید اقساطی" }]} variant="light" /><div className="mt-10 max-w-2xl"><p className="text-sm font-black text-[#ffd3e7]">پرداخت آسان، سفر لذت‌بخش</p><h1 className="mt-3 text-4xl font-black sm:text-6xl">{title}</h1><p className="mt-5 text-base leading-8 text-white/90 sm:text-lg">{intro}</p><Link className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-accent-strong px-5 font-black text-white shadow-[0_10px_24px_rgba(235,93,159,0.28)] transition hover:bg-white hover:text-brand" href={contactHref}>دریافت مشاوره اقساط</Link></div></Container>
    </section>
    <main className="bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_52%)] py-10 sm:py-14"><Container>
      <section aria-labelledby="installment-steps-title"><div className="text-center"><p className="text-sm font-black text-accent-strong">شرایط ساده و شفاف</p><h2 className="mt-2 text-3xl font-black text-brand" id="installment-steps-title">پرداخت اقساطی سفر</h2></div><div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">{steps.map((step) => (
        <article className="relative rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-[0_10px_24px_rgba(1,37,105,0.09)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(1,37,105,0.14)]" key={step.number}>
          <span className="absolute -top-4 right-1/2 grid size-9 translate-x-1/2 place-items-center rounded-full border-4 border-[#f8fbff] bg-brand text-sm font-black text-white shadow-[0_5px_12px_rgba(1,37,105,0.22)]">{step.number}</span>
          <span className={"mx-auto mt-3 grid size-[4.5rem] place-items-center rounded-[1.45rem] ring-8 shadow-sm " + step.iconClass} aria-hidden="true"><InstallmentStepIcon name={step.icon} /></span>
          <h3 className="mt-4 font-black text-brand">{step.title}</h3>
          <p className="mt-2 text-xs leading-6 text-muted">{step.text}</p>
        </article>
      ))}</div></section>
      <section className="mt-10"><InstallmentCalculator defaultAmount={numeric(links.installmentDefaultAmount, 120000000)} defaultDownPaymentPercent={clamp(numeric(links.installmentDownPaymentPercent, 25), minimumDownPaymentPercent, 100)} defaultFeeRate={defaultFeeRate} expertHref={contactHref} maximumFeeRate={maximumFeeRate} maximumMonths={maximumMonths} minimumDownPaymentPercent={minimumDownPaymentPercent} /></section>
      <section aria-labelledby="installment-services-title" className="mt-12"><div className="text-center"><p className="text-sm font-black text-accent-strong">خدمات قابل انتخاب</p><h2 className="mt-2 text-3xl font-black text-brand" id="installment-services-title">خدمات قابل پرداخت به صورت اقساطی</h2></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{enabledServices.map((service) => <article className="rounded-2xl border border-border bg-white p-5 text-center shadow-sm" key={service.key}><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff1f7] text-xl font-black text-accent-strong" aria-hidden="true">{service.icon}</span><h3 className="mt-3 font-black text-brand">{service.title}</h3><p className="mt-1 text-xs text-muted">{service.description}</p></article>)}</div></section>
      {toursEnabled ? <section aria-labelledby="installment-tours-title" className="mt-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-accent-strong">تورهای دارای امکان پرداخت اقساطی</p><h2 className="mt-1 text-3xl font-black text-brand" id="installment-tours-title">تورهای اقساطی</h2></div><span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-black text-brand">{tours.items.length.toLocaleString("fa-IR")} تور</span></div>{tours.items.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{tours.items.map((tour) => <TourListingCard country={tour.destination?.country} countryFlagImageId={countryFlagImageIds.get(normalizeCountryName(tour.destination?.country)) ?? null} departureDate={tour.departureDate ? formatPersianDate(tour.departureDate) : null} destination={tour.destination?.title || "مقصد منتخب"} durationDays={tour.durationDays} featured={tour.isFeatured} id={tour.id} imageUrl={tour.imageId ? PUBLIC_API_BASE_URL + "/media/" + tour.imageId : null} installmentAvailable key={tour.id} price={toToman(tour.priceAmount, tour.currency, exchangeRates) !== null ? formatCurrency(String(toToman(tour.priceAmount, tour.currency, exchangeRates)), "IRT") : "استعلام قیمت"} slug={tour.slug} summary={tour.summary} title={tour.title} transportation={tour.transportation} />)}</div> : <div className="mt-6"><EmptyState description="از پنل مدیریت، گزینه «قابل خرید اقساطی» را برای تور فعال کنید." title="هنوز تور اقساطی منتشر نشده است" /></div>}</section> : null}
    </Container></main>
  </>;
}
