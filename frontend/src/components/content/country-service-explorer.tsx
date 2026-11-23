"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { HotelStars } from "@/components/content/hotel-stars";
import {
  BookIcon,
  HotelIcon,
  LocationIcon,
} from "@/components/layout/site-icons";
import { CountryFilters } from "@/components/content/country-filters";
import styles from "./country-showcase.module.css";
import { dedupeCountriesByName, normalizeCountryName } from "@/lib/country-name";

type Country = {
  id: number;
  imageId?: number | null;
  name: string;
};

type ExplorerItem = {
  country: string;
  details: Array<{ label: string; value: string }>;
  href: string;
  id: number;
  imageUrl?: string | null;
  kind: "hotel" | "visa";
  starRating?: number;
  guestRating?: "excellent" | "good" | "average" | null;
  price?: string | null;
  subtitle: string;
  title: string;
  visaType?: string | null;
};

const guestRatingLabels = {
  excellent: "عالی",
  good: "خوب",
  average: "متوسط",
} as const;

function ItemCard({ item }: { item: ExplorerItem }) {
  const isHotel = item.kind === "hotel";
  const Icon = isHotel ? HotelIcon : BookIcon;
  const guestRatingLabel = item.guestRating
    ? guestRatingLabels[item.guestRating]
    : null;

  return (
    <article className="catalog-card group border border-border bg-white shadow-[0_12px_34px_rgba(1,37,105,0.08)] transition duration-300 hover:-translate-y-1 hover:border-brand/25 hover:shadow-[0_20px_44px_rgba(1,37,105,0.14)]">
      <Link
        className="catalog-card__media relative block overflow-hidden bg-brand"
        href={item.href}
      >
        {item.imageUrl ? (
          <Image
            alt={item.title}
            className="object-cover transition duration-500 group-hover:scale-105"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={item.imageUrl}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#D8EAFF_0,transparent_38%),linear-gradient(135deg,#012569_0%,#174891_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand/60 via-brand/10 to-transparent" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-black text-brand backdrop-blur">
          <Icon className="size-3.5" /> {isHotel ? "هتل" : "ویزا"}
        </span>
        <span className="absolute bottom-3 right-3 inline-flex max-w-[85%] items-center gap-1 rounded-full bg-brand/85 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
          <LocationIcon className="size-3.5 shrink-0 text-accent" />
          <span className="truncate">{item.subtitle}</span>
        </span>
      </Link>
      <div className="catalog-card__body p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-h-10 break-words text-sm font-black leading-5 text-brand" dir="auto">
            <Link href={item.href}>{item.title}</Link>
          </h3>
          {isHotel && guestRatingLabel ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
              {guestRatingLabel}
            </span>
          ) : null}
        </div>
        <dl className="catalog-card__facts mt-3 divide-y divide-dashed divide-border border-y border-dashed border-border text-xs">
          {item.details.slice(0, 3).map((detail, index) => (
            <div
              className="flex items-center justify-between gap-3 py-2"
              key={detail.label}
            >
              <dt className="text-muted">{detail.label}</dt>
              <dd className="flex min-h-5 items-center truncate font-bold text-foreground">
                {isHotel && index === 0 && item.starRating ? (
                  <HotelStars rating={item.starRating} />
                ) : (
                  detail.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        <div className="catalog-card__footer mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-muted">
              {isHotel ? "قیمت ۱ شب، ۱ اتاق یک‌تخته" : "هزینه پایه"}
            </p>
            <strong className="block truncate text-sm text-brand">
              {item.price || "استعلام قیمت"}
            </strong>
          </div>
          <Link
            aria-label={`${isHotel ? "مشاهده هتل" : "جزئیات ویزا"} ${item.title}`}
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-brand px-3 text-xs font-black text-white transition group-hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
            href={item.href}
          >
            {isHotel ? "مشاهده هتل" : "جزئیات ویزا"}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CountryServiceExplorer({
  countries,
  emptyText,
  items,
  listHref,
  listLabel,
}: {
  countries: Country[];
  emptyText: string;
  items: ExplorerItem[];
  listHref: string;
  listLabel: string;
}) {
  const uniqueCountries = useMemo(
    () => dedupeCountriesByName(countries),
    [countries],
  );
  const visibleCountries = useMemo(
    () =>
      uniqueCountries.filter((country) =>
        items.some((item) => normalizeCountryName(item.country) === normalizeCountryName(country.name)),
      ),
    [items, uniqueCountries],
  );
  const [activeCountry, setActiveCountry] = useState("all");
  const [limit, setLimit] = useState(9);
  const [activeVisaType, setActiveVisaType] = useState("all");
  const activeItems = items.filter(
    (item) =>
      (activeCountry === "all" || normalizeCountryName(item.country) === normalizeCountryName(activeCountry)) &&
      (item.kind !== "visa" ||
        activeVisaType === "all" ||
        item.visaType === activeVisaType),
  );
  const isVisaExplorer = items.some((item) => item.kind === "visa");
  return (
    <div className={styles.explorer} dir="rtl" data-country-explorer={isVisaExplorer ? "visa" : "hotel"}>
      <CountryFilters countries={visibleCountries} active={activeCountry} label={`فیلتر کشور ${listLabel}`} onChange={(country)=>{setActiveCountry(country);setActiveVisaType("all");setLimit(9);}} />
      <div className={styles.toolbar}><p>{activeItems.length.toLocaleString("fa-IR")} مورد{activeCountry === "all" ? " در همه کشورها" : ` در ${activeCountry}`}</p><Link href={activeCountry === "all" ? listHref : `${listHref}${listHref.includes("?") ? "&" : "?"}country=${encodeURIComponent(activeCountry)}`}>مشاهده همه موارد ←</Link></div>
      {isVisaExplorer ? <div className={styles.subfilters} role="group" aria-label="فیلتر نوع ویزا">{[["all","همه انواع ویزا"],["tourist","توریستی"],["business","تجاری"],["exhibition","نمایشگاهی"],["residency","اقامتی"],["student","دانشجویی"]].map(([value,label])=><button aria-pressed={activeVisaType===value} key={value} type="button" onClick={()=>{setActiveVisaType(value);setLimit(9);}}>{label}</button>)}</div> : null}
      {activeItems.length ? <div className={styles.grid}>{activeItems.slice(0,limit).map(item=><ItemCard item={item} key={`${item.kind}-${item.id}`} />)}</div> : <p className={styles.empty}>{emptyText}</p>}
      {activeItems.length > limit ? <button className={styles.more} type="button" onClick={()=>setLimit(current=>current+9)}>نمایش بیشتر</button> : null}
    </div>
  );
}
