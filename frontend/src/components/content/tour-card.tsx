import Image from "next/image";
import Link from "next/link";

import {
  BookIcon,
  ClockIcon,
  LocationIcon,
  PlaneIcon,
  SuitcaseIcon,
} from "@/components/layout/site-icons";
import { CompareToggle, type ComparisonItem } from "@/components/content/comparison-provider";

type TourCardProps = {
  id: number;
  title: string;
  destination: string;
  country?: string | null;
  departure: string;
  departureDate?: string | null;
  duration: string;
  transport: string;
  price: string;
  summary?: string | null;
  href: string;
  featured?: boolean;
  hotel?: string | null;
  imageUrl?: string | null;
};

export function TourCard({
  id,
  title,
  destination,
  country,
  departure,
  departureDate,
  duration,
  transport,
  price,
  summary,
  href,
  featured = false,
  hotel,
  imageUrl,
}: TourCardProps) {
  const services =
    summary?.trim() ||
    (hotel
      ? `اقامت در ${hotel}، حمل‌ونقل و خدمات تور`
      : "حمل‌ونقل، اقامت و خدمات تور");

  const comparisonItem: ComparisonItem = {
    id: `tour:${id}`,
    kind: "tour",
    title,
    href,
    imageUrl,
    price,
    fields: [
      { label: "مقصد", value: `${destination}${country ? `، ${country}` : ""}` },
      { label: "تاریخ برگزاری", value: departureDate || "اعلام می‌شود" },
      { label: "مدت اقامت", value: duration },
      { label: "حمل‌ونقل", value: `${departure} · ${transport}` },
      { label: "هتل", value: hotel || "طبق برنامهٔ سفر" },
      { label: "خدمات", value: services },
    ],
  };
  return (
    <article
      data-tour-id={id}
      data-scroll-reveal
      className="catalog-card group border border-border bg-white text-foreground shadow-[0_12px_32px_rgba(1,37,105,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(1,37,105,0.14)] focus-within:ring-4 focus-within:ring-accent"
    >
      <Link className="catalog-card__media relative block overflow-hidden bg-brand" href={href}>
        {imageUrl ? (
          <Image
            alt={title}
            className="object-cover transition duration-500 group-hover:scale-105"
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            src={imageUrl}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_20%_18%,rgba(216,234,255,.9)_0,transparent_30%),linear-gradient(135deg,#001a4a_0%,#174891_62%,#4e83c4_100%)]">
            <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-black text-white/90 backdrop-blur">تصویر تور در حال تکمیل</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand/35 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-black text-white ${featured ? "bg-accent-strong" : "bg-brand/90"}`}>
            {featured ? "پرفروش" : "تور"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/80 px-2.5 py-1.5 text-[10px] font-black text-brand shadow-[0_8px_20px_rgba(1,37,105,.16)] backdrop-blur-md transition group-hover:bg-accent">
            <LocationIcon className="size-3.5" />
            {destination}{country ? `، ${country}` : ""}
          </span>
        </div>
      </Link>

      <div className="catalog-card__body p-4">
        <h2 className="min-h-10 break-words text-sm font-black leading-5 text-foreground" dir="auto">
          <Link className="rounded-sm focus-visible:ring-2 focus-visible:ring-brand" href={href}>
            {title}
          </Link>
        </h2>

        <dl className="catalog-card__facts mt-3 space-y-2 text-[11px]">
          <TourFact icon={<ClockIcon className="size-4" />} label="تاریخ برگزاری" value={departureDate || "اعلام می‌شود"} accent />
          <TourFact icon={<SuitcaseIcon className="size-4" />} label="مدت اقامت" value={duration} />
          <TourFact icon={<PlaneIcon className="size-4" />} label="حمل‌ونقل" value={`${departure} · ${transport}`} />
        </dl>

        <p className="catalog-card__summary mt-2 flex items-start gap-2 border-b border-dashed border-border pb-3 text-[11px] leading-5 text-muted">
          <BookIcon className="mt-0.5 size-4 shrink-0 text-brand" />
          <span className="line-clamp-2">{services}</span>
        </p>

        <div className="catalog-card__footer mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <span className="text-[10px] text-muted">شروع قیمت از</span>
            <strong className="mt-1 block text-base text-brand">{price}</strong>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CompareToggle item={comparisonItem} />
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-black text-white transition hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
              href={href}
            >
              مشاهده تور
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function TourFact({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-border pb-2">
      <dt className="inline-flex items-center gap-1.5 text-muted">
        <span className="text-brand" aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className={`text-left font-bold ${accent ? "text-accent-strong" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}
