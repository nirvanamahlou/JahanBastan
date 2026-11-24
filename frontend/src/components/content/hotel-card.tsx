import Image from "next/image";
import Link from "next/link";

import { hotelMapSearchUrl } from "@/components/content/hotel-location-map";
import { HotelStars } from "@/components/content/hotel-stars";
import { CountryFlag } from "@/components/content/country-flag";
import { CompareToggle, type ComparisonItem } from "@/components/content/comparison-provider";
import styles from "./catalog-layout.module.css";
import { HotelIcon, LocationIcon } from "@/components/layout/site-icons";

type HotelCardProps = {
  listLayout?: boolean;
  slug: string;
  name: string;
  destination: string;
  country: string;
  countryFlagImageId?: number | null;
  starRating: number;
  summary: string;
  region?: string | null;
  address?: string | null;
  imageUrl?: string | null;
  guestRating?: "excellent" | "good" | "average" | null;
};

const guestRatingLabels = {
  excellent: "عالی",
  good: "خوب",
  average: "متوسط",
} as const;
const persianPlaceNames: Record<string, string> = {
  madrid: "مادرید",
  spain: "اسپانیا",
  istanbul: "استانبول",
  turkey: "ترکیه",
  antalya: "آنتالیا",
  alanya: "آلانیا",
  kusadasi: "کوش‌آداسی",
  bodrum: "بدروم",
  beijing: "پکن",
  china: "چین",
  moscow: "مسکو",
  "saint petersburg": "سن پترزبورگ",
  russia: "روسیه",
  barcelona: "بارسلون",
  tbilisi: "تفلیس",
  georgia: "گرجستان",
  tehran: "تهران",
  iran: "ایران",
};

function localizePlaceName(value: string) {
  const normalized = value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  return persianPlaceNames[normalized] ?? value;
}

export function HotelCard({
  listLayout = false,
  slug,
  name,
  destination,
  country,
  countryFlagImageId,
  starRating,
  summary,
  region,
  address,
  imageUrl,
  guestRating = null,
}: HotelCardProps) {
  const href = `/hotels/${slug}/`;
  // Catalogue cards intentionally use only the dedicated square cover image.
  // Gallery assets belong to the hotel detail page and never leak into cards.
  const mainImage = imageUrl ?? null;
  const guestRatingLabel = guestRating ? guestRatingLabels[guestRating] : null;
  const mapUrl = hotelMapSearchUrl({ name, address, region, destination, country });
  const locationLabel = [
    region ? localizePlaceName(region) : null,
    localizePlaceName(destination),
    localizePlaceName(country),
  ]
    .filter(Boolean)
    .join("، ");
  const comparisonItem: ComparisonItem = {
    id: `hotel:${slug}`,
    kind: "hotel",
    title: name,
    href,
    imageUrl: mainImage,
    price: "تماس بگیرید",
    fields: [
      { label: "مقصد", value: `${destination}، ${country}` },
      { label: "منطقه", value: region || "—" },
      { label: "درجهٔ هتل", value: `${starRating} ستاره` },
      { label: "امتیاز مهمان", value: guestRatingLabel || "ثبت نشده" },
      { label: "نشانی", value: address || locationLabel },
      { label: "معرفی", value: summary },
    ],
  };
  return (
    <article
      className={`${listLayout ? styles.hotelListCard : "catalog-card"} group border border-border bg-white shadow-[0_12px_32px_rgba(1,37,105,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(1,37,105,0.14)]`}
      data-hotel-list-card={listLayout || undefined}
      data-scroll-reveal
    >
      <Link
        aria-label={`مشاهده هتل ${name}`}
        className={`${listLayout ? styles.hotelListPhoto : "catalog-card__media"} relative block overflow-hidden bg-surface-muted`}
        href={href}
      >
        {mainImage ? (
          <Image
            alt={name}
            className="object-cover transition duration-500 group-hover:scale-105"
            fill
            sizes={listLayout ? "(max-width: 640px) 30vw, 260px" : "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"}
            src={mainImage}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_20%_18%,rgba(216,234,255,.9)_0,transparent_30%),linear-gradient(135deg,#001a4a_0%,#174891_62%,#4e83c4_100%)]">
            <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-black text-white/90 backdrop-blur">تصویر هتل در حال تکمیل</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand/45 via-transparent to-transparent" />
        {guestRatingLabel ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm backdrop-blur">
            امتیاز مهمان: {guestRatingLabel}
          </span>
        ) : null}
      </Link>

      <div className={`${listLayout ? styles.hotelListBody : "catalog-card__body"} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="min-h-10 break-words text-sm font-black leading-5 text-foreground" dir="auto">
              <Link href={href}>{name}</Link>
            </h3>
            <div className="mt-2 grid min-w-0 gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-muted">
                <LocationIcon className="size-4 shrink-0 text-accent-strong" />
                <CountryFlag country={country} imageId={countryFlagImageId} />
                <span className="truncate" dir="rtl" lang="fa" title={address || locationLabel}>
                  {locationLabel}
                </span>
              </p>
              <a
                aria-label={`مشاهده نقشه ${name}`}
                className="inline-flex min-h-9 w-fit items-center justify-center rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-black text-accent-strong transition hover:bg-accent-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                href={mapUrl}
                rel="noreferrer"
                target="_blank"
              >
                مشاهده نقشه
              </a>
            </div>
          </div>
          <HotelStars className="shrink-0" rating={starRating} />
        </div>

        <p className={`${listLayout ? styles.hotelListSummary : "catalog-card__summary"} mt-3 line-clamp-2 text-sm leading-6 text-muted`}>
          {summary}
        </p>

        <div className={`${listLayout ? styles.hotelListFooter : "catalog-card__footer"} mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4`}>
          <div className="min-w-0">
            <span className="text-[11px] text-muted">
              قیمت اقامت
            </span>
            <strong className="mt-1 block truncate text-base text-brand">
              تماس بگیرید
            </strong>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CompareToggle item={comparisonItem} />
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 text-sm font-black text-white transition hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
              href={href}
            >
              <HotelIcon className="size-4" />
              مشاهده هتل
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
