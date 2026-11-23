import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { CountryFlag } from "@/components/content/country-flag";
import { RefundPolicyButton } from "@/components/content/refund-policy-button";
import { VisaDocumentUploadCard } from "@/components/content/visa-document-upload-card";
import { PageIntro } from "@/components/layout/page-intro";
import { Container } from "@/components/ui/container";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatBaggageAllowance } from "@/lib/baggage";
import { formatCurrency } from "@/lib/currency";
import { findCountryImageId } from "@/lib/country-name";
import { formatPersianDate } from "@/lib/persian-date";
import { formatTravelDuration } from "@/lib/travel-duration";

type Props = { params: Promise<{ slug: string }> };
type Service = {
  id: number; title: string; serviceType: string; serviceCategory: string | null; summary: string; description: string; imageId: number | null; galleryImageIds: number[];
  country: string | null; origin: string | null; destinationName: string | null; originAirport: string | null; originAirportCode: string | null; destinationAirport: string | null; destinationAirportCode: string | null;
  departureDate: string | null; returnDate: string | null; departureTime: string | null; arrivalTime: string | null; returnTime: string | null; returnArrivalTime: string | null;
  baggageAllowance: string | null; providerCompany: string | null; flightClass: string | null; aircraftModel: string | null; tripType: "one_way" | "round_trip" | null; basePrice: string | null; currency: string;
  visaRequirements: string | null; visaDocumentRequirements: string[]; visaProcessingTime: string | null; visaFormUrl: string | null; refundPolicy: string | null; metaTitle: string | null; metaDescription: string | null; availableSeats: number | null;
};
type Country = { name: string; imageId: number | null };
const shown = (value: string | null) => value || "اعلام می‌شود";
const airportLabel = (name: string | null, code: string | null) => code ? `${shown(name)} (${code})` : shown(name);
const dateShown = (value: string | null) => value ? formatPersianDate(value) : "اعلام می‌شود";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await apiGet<Service>(`/services/${slug}`, { cache: "no-store" }).catch(() => null);
  return {
    title: item?.metaTitle ?? item?.title ?? "خدمات سفر",
    description: item?.metaDescription ?? item?.summary,
    alternates: { canonical: `/services/${slug}/` },
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const [item, countryPayload] = await Promise.all([
    apiGet<Service>(`/services/${slug}`, { cache: "no-store" }).catch(() => null),
    apiGet<{ items: Country[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
  ]);
  if (!item) notFound();
  const countryFlagImageId = findCountryImageId(countryPayload.items, item.country);
  const isVisa = item.serviceType === "visa";
  const isTransport = ["flight", "train", "bus"].includes(item.serviceType);
  const outboundDuration = formatTravelDuration(item.departureTime, item.arrivalTime);
  const returnDuration = formatTravelDuration(item.returnTime, item.returnArrivalTime);
  const facts = isVisa ? [
    ["کشور", shown(item.country)], ["تاریخ سفر", dateShown(item.departureDate)],
    ["زمان بررسی", shown(item.visaProcessingTime)], ["هزینه پایه", item.basePrice ? formatCurrency(item.basePrice, item.currency) : "استعلام"],
  ] : [
    ["مسیر", `${shown(item.origin)} تا ${shown(item.destinationName)}`],
    ...(item.serviceType === "flight" ? [
      ["فرودگاه مبدأ", airportLabel(item.originAirport, item.originAirportCode)],
      ["فرودگاه مقصد", airportLabel(item.destinationAirport, item.destinationAirportCode)],
    ] : []),
    ["تاریخ و ساعت رفت", `${dateShown(item.departureDate)} · ${shown(item.departureTime?.slice(0, 5) ?? null)}`],
    ...(item.tripType !== "one_way" ? [["تاریخ و ساعت برگشت", `${dateShown(item.returnDate)} · ${shown(item.returnTime?.slice(0, 5) ?? null)}`]] : []),
    ["شرکت خدمات‌دهنده", shown(item.providerCompany)], ["بار مجاز", formatBaggageAllowance(item.baggageAllowance)],
    ...(isTransport ? [["ظرفیت باقی‌مانده", item.availableSeats === null ? "در حال استعلام" : item.availableSeats === 0 ? "تکمیل ظرفیت" : `${item.availableSeats.toLocaleString("fa-IR")} صندلی باقی‌مانده`]] : []),
    ...(isTransport && outboundDuration ? [["مدت سفر رفت", outboundDuration]] : []),
    ...(isTransport && returnDuration ? [["مدت سفر برگشت", returnDuration]] : []),
    ...(item.serviceCategory ? [["دسته‌بندی خدمت", ({ scheduled: "پرواز سیستمی", charter: "پرواز چارتر", promotional: "پرواز ویژه", passenger: "قطار مسافری", high_speed: "قطار سریع‌السیر", overnight: "قطار شب‌رو", standard: "اتوبوس عادی", vip: "اتوبوس VIP", sleeper: "اتوبوس تخت‌شو" } as Record<string, string>)[item.serviceCategory] ?? item.serviceCategory]] : []),
    ...(item.serviceType === "flight" ? [["کلاس پرواز", ({ economy: "اکونومی", premium_economy: "پریمیوم اکونومی", business: "بیزینس کلاس", first: "فرست کلاس" } as Record<string, string>)[item.flightClass ?? ""] ?? "اعلام می‌شود"], ["مدل هواپیما", shown(item.aircraftModel)]] : []),
  ];
  const images = [item.imageId, ...(item.galleryImageIds ?? [])].filter((id, index, values): id is number => Boolean(id) && values.indexOf(id) === index);
  const visaInteractiveCard = isVisa
    ? "border border-border bg-surface transition-all duration-300 ease-out hover:-translate-y-1 hover:border-brand/35 hover:bg-accent/20 hover:shadow-[0_18px_45px_rgba(8,48,117,0.12)] focus-within:border-brand/40 focus-within:shadow-[0_18px_45px_rgba(8,48,117,0.12)]"
    : "border border-border bg-surface";
  return <>{isVisa ? <span hidden data-nora-category="visas" /> : null}<PageIntro eyebrow={isVisa && item.country ? <span className="inline-flex items-center gap-2"><CountryFlag country={item.country} imageId={countryFlagImageId} />خدمات ویزای {item.country}</span> : "خدمات حمل‌ونقل"} title={item.title} description={item.summary} /><Container className="py-12">
    {!isVisa && images.length ? <section aria-labelledby="service-gallery-title">
      <h2 className="sr-only" id="service-gallery-title">گالری تصاویر</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{images.map((id, index) => <div className={`group relative aspect-square overflow-hidden rounded-2xl border border-transparent bg-accent/20 transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg ${index === 0 ? "sm:col-span-2 sm:aspect-[2/1] lg:col-span-2" : ""}`} key={id}><Image alt={`${item.title} - تصویر ${index + 1}`} className="object-cover transition-transform duration-500 ease-out group-hover:scale-105" fill sizes={index === 0 ? "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw" : "(max-width: 640px) 100vw, 50vw"} src={`${PUBLIC_API_BASE_URL}/media/${id}`} /></div>)}</div>
    </section> : null}
    <dl className={`mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 ${isVisa ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>{facts.map(([label,value], index) => <div className={`group relative min-w-0 overflow-hidden rounded-2xl p-5 ${isVisa ? visaInteractiveCard : "bg-accent/30"}`} key={label}>{isVisa ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 origin-right scale-x-0 bg-highlight transition-transform duration-300 group-hover:scale-x-100" /> : null}<div className="flex items-start justify-between gap-3"><div className="min-w-0"><dt className="text-sm font-bold text-muted">{label}</dt><dd className="mt-2 inline-flex items-center gap-2 break-words text-base font-black leading-7 text-brand">{label === "کشور" && item.country ? <CountryFlag country={item.country} imageId={countryFlagImageId} /> : null}{value}</dd></div>{isVisa ? <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-sm font-black text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white">{(index + 1).toLocaleString("fa-IR")}</span> : null}</div></div>)}</dl>
    <RefundPolicyButton policy={item.refundPolicy} />
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-8">{isVisa && item.visaFormUrl ? <section className={`rounded-2xl p-6 ${visaInteractiveCard}`}><h2 className="text-xl font-black text-brand">فرم درخواست ویزا</h2><p className="mt-2 text-sm leading-7 text-muted">فرم نمونه را دانلود کنید، کامل و دقیق با خودکار آبی پر کنید؛ سپس نسخه اسکن‌شده را در درخواست ویزا بارگذاری کنید.</p><a className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-primary" download href={item.visaFormUrl}>دانلود فرم نمونه ویزا</a></section> : null}{isVisa && item.visaRequirements ? <section className={`rounded-2xl p-6 ${visaInteractiveCard}`}><h2 className="mb-4 text-xl font-black text-brand">مدارک و شرایط پایه ویزا</h2><RichText content={item.visaRequirements} /></section> : null}<article className={isVisa ? `rounded-2xl p-6 sm:p-7 ${visaInteractiveCard}` : ""}>
{isVisa ? <h2 className="mb-5 text-xl font-black text-brand">توضیحات کامل ویزا</h2> : null}<RichText className="text-foreground" content={item.description} /></article></div><div className="space-y-5"><aside className={`rounded-2xl p-5 ${isVisa ? visaInteractiveCard : "border border-border bg-surface"}`}><h2 className="font-black text-brand">نیاز به راهنمایی دارید؟</h2><p className="mt-2 text-sm leading-7 text-muted">برای بررسی ظرفیت، قیمت نهایی و شرایط روز با کارشناسان ما تماس بگیرید.</p><Link className="mt-5 block rounded-xl bg-accent px-4 py-3 text-center font-black text-brand transition-all duration-300 hover:bg-brand hover:text-white hover:shadow-md" href="/contact/">درخواست مشاوره</Link></aside>{isVisa ? <VisaDocumentUploadCard requirements={item.visaDocumentRequirements ?? []} serviceId={item.id} serviceTitle={item.title} /> : null}</div></div>
    {isVisa && images.length ? <section aria-label={`تصاویر ${item.title}`} className={`mt-10 rounded-3xl p-4 sm:p-5 ${visaInteractiveCard}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{images.map((id, index) => <div className={`group relative aspect-square overflow-hidden rounded-2xl border border-transparent bg-accent/20 transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg ${index === 0 ? "sm:col-span-2 sm:aspect-[2/1] lg:col-span-2" : ""}`} key={id}><Image alt={`${item.title} - تصویر ${index + 1}`} className="object-cover transition-transform duration-500 ease-out group-hover:scale-105" fill sizes={index === 0 ? "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw" : "(max-width: 640px) 100vw, 50vw"} src={`${PUBLIC_API_BASE_URL}/media/${id}`} /></div>)}</div>
    </section> : null}
  </Container></>;
}
