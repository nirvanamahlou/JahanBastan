import Image from "next/image";
import Link from "next/link";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { ClockIcon, LocationIcon, PlaneIcon, SuitcaseIcon } from "@/components/layout/site-icons";

type TourListingCardProps = {
  id: number;
  slug: string;
  title: string;
  destination: string;
  country?: string | null;
  countryFlagImageId?: number | null;
  departureDate?: string | null;
  durationDays?: number | null;
  transportation?: string | null;
  airlineName?: string | null;
  hotelStars?: number | null;
  price: string;
  summary?: string | null;
  imageUrl?: string | null;
  featured?: boolean;
  installmentAvailable?: boolean;
  directFlight?: boolean;
  lastMinute?: boolean;
  badgeLabel?: string | null;
  large?: boolean;
};

export function TourListingCard({
  id, slug, title, destination, country, countryFlagImageId, departureDate, durationDays,
  transportation, airlineName, hotelStars, price, summary, imageUrl, featured,
  installmentAvailable, directFlight, lastMinute, badgeLabel, large = false,
}: TourListingCardProps) {
  const href = `/tours/${slug}/`;
  const facts = [
    { icon: <ClockIcon className="size-3.5" />, value: departureDate || "به‌زودی" },
    { icon: <SuitcaseIcon className="size-3.5" />, value: durationDays ? `${durationDays.toLocaleString("fa-IR")} روز` : "مدت اعلام می‌شود" },
    { icon: <PlaneIcon className="size-3.5" />, value: airlineName || transportation || "حمل‌ونقل اعلام می‌شود" },
  ];

  return (
    <article data-tour-id={id} className={`catalog-card ${large ? "" : "catalog-card--compact"} group relative border border-border bg-white shadow-[0_12px_32px_rgba(1,37,105,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(1,37,105,0.14)] ${featured ? "border-brand ring-1 ring-brand/10" : "border-slate-200"}`}>
      <Link className="catalog-card__media relative block overflow-hidden bg-brand" href={href}>
        {imageUrl ? <Image alt={title} className="object-cover transition duration-500 group-hover:scale-105" fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" src={imageUrl} /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,#8eb8ff_0,transparent_28%),linear-gradient(135deg,#012569,#174891)]" />}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-brand/70 to-transparent" />
        <div className="absolute inset-x-2 top-2 flex flex-wrap justify-between gap-2"><span className="rounded-md bg-brand/90 px-2 py-1 text-[10px] font-black text-white backdrop-blur">{directFlight ? "پرواز مستقیم" : transportation || "تور منتخب"}</span><div className="flex gap-1">{lastMinute ? <span className="rounded-md bg-accent-strong px-2 py-1 text-[10px] font-black text-white">لحظه‌آخری</span> : null}{badgeLabel ? <span className="rounded-md bg-accent-strong px-2 py-1 text-[10px] font-black text-white">{badgeLabel}</span> : featured && !lastMinute ? <span className="rounded-md bg-accent-strong px-2 py-1 text-[10px] font-black text-white">ویژه</span> : null}</div></div>
        {hotelStars ? <span className="absolute bottom-2 right-2 rounded-md bg-white/95 px-2 py-1 text-[10px] font-black text-brand">هتل {hotelStars.toLocaleString("fa-IR")} ستاره</span> : null}
      </Link>
      <div className={`catalog-card__body ${large ? "p-4" : "p-3"}`}>
        <p className="inline-flex items-center gap-1 text-xs font-bold text-muted"><LocationIcon className="size-3.5 text-accent-strong" />{countryFlagImageId ? <Image alt="" aria-hidden className="h-3.5 w-5 rounded-sm object-cover" height={14} src={`${PUBLIC_API_BASE_URL}/media/${countryFlagImageId}`} width={20} /> : null}{destination}{country ? `، ${country}` : ""}</p>
        <h2 className={`${large ? "mt-3 min-h-10 text-sm leading-5" : "mt-2 min-h-10 text-sm leading-5"} break-words font-black text-foreground`} dir="auto"><Link href={href}>{title}</Link></h2>
        <div className="catalog-card__facts mt-3 grid gap-1 border-y border-dashed border-border py-2 text-[10px] text-muted">{facts.map((fact) => <span className="inline-flex min-w-0 items-center gap-1" key={fact.value}><span className="shrink-0">{fact.icon}</span><span className="truncate">{fact.value}</span></span>)}</div>
        <p className={`catalog-card__summary mt-3 line-clamp-2 text-xs leading-6 text-muted`}>{summary || "جزئیات سفر و اقامت در صفحهٔ تور"}</p>
        <div className="catalog-card__footer mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4"><div className="min-w-0"><p className="text-[11px] text-muted">شروع قیمت از</p><strong className="mt-1 block text-base text-brand">{price}</strong>{installmentAvailable ? <span className="mt-1 block text-[10px] font-black text-accent-strong">امکان خرید اقساطی</span> : null}</div><Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-black text-white transition hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent" href={href}>مشاهده تور</Link></div>
      </div>
    </article>
  );
}