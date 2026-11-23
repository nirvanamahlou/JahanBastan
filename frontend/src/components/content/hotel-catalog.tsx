"use client";


import { ResponsiveFilterPanel } from "./responsive-filter-panel";
import { CountryCityFields } from "./country-city-fields";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { HotelCard } from "@/components/content/hotel-card";
import { HotelStars } from "@/components/content/hotel-stars";
import { SearchIcon } from "@/components/layout/site-icons";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteSelect } from "@/components/ui/site-select";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { normalizeCountryName } from "@/lib/country-name";

export type CatalogHotel = {
  id: number;
  name: string;
  slug: string;
  starRating: number;
  guestRating: "excellent" | "good" | "average" | null;
  summary: string;
  region: string | null;
  address: string | null;
  imageId: number | null;
  galleryImageIds: number[];
  destination: { title: string; slug: string; country: string };
};
type DestinationOption = { id: number; title: string; slug: string; country: string };

function normalizeHotelQuery(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

export function HotelCatalog({ hotels, destinations, selectedDestinationSlug, country, passengerCount, countryFlagImageIds, countries }: { countries: { name: string }[]; hotels: CatalogHotel[]; destinations: DestinationOption[]; selectedDestinationSlug: string; country: string; passengerCount: string; countryFlagImageIds: Record<string, number | null> }) {
  const router = useRouter();
  const [selectedStars, setSelectedStars] = useState<number[]>([]);
  const [hotelQuery, setHotelQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const cities = useMemo(() => [...destinations].sort((first, second) => first.title.localeCompare(second.title, "fa")), [destinations]);

  const visibleHotels = useMemo(() => {
    const normalizedQuery = normalizeHotelQuery(hotelQuery);
    const filtered = hotels.filter((hotel) => {
      return (
        (!normalizedQuery || normalizeHotelQuery(hotel.name).includes(normalizedQuery)) &&
        (!selectedStars.length || selectedStars.includes(hotel.starRating))
      );
    });

    return [...filtered].sort((first, second) => {
      if (sort === "stars-desc") return second.starRating - first.starRating;
      return (
        Number(second.guestRating === "excellent") -
        Number(first.guestRating === "excellent")
      );
    });
  }, [hotelQuery, hotels, selectedStars, sort]);

  const toggleStar = (star: number) => {
    setSelectedStars((current) =>
      current.includes(star)
        ? current.filter((item) => item !== star)
        : [...current, star],
    );
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-[1.75rem] border border-border bg-white p-5 shadow-[0_16px_40px_rgba(1,37,105,.08)] lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto lg:overscroll-contain">
        <ResponsiveFilterPanel title="فیلتر هتل‌ها">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-brand">فیلترها</h2>
          <button
            className="text-xs font-bold text-brand transition hover:text-accent-strong"
            onClick={() => {
              const params = new URLSearchParams();
              if (country) params.set("country", country);
              if (passengerCount) params.set("passengerCount", passengerCount);
              router.push(params.size ? `/hotels/?${params}` : "/hotels/");
              setSelectedStars([]);
              setHotelQuery("");
              setSort("recommended");
            }}
            type="button"
          >
            پاک کردن
          </button>
        </div>

        <label className="mt-6 grid min-w-0 gap-2 border-t border-border pt-5 text-sm font-black text-brand">
          جستجوی نام هتل
          <span className="relative block min-w-0">
            <SearchIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-brand" />
            <input
              aria-label="جستجوی نام هتل"
              autoComplete="off"
              className="box-border min-h-12 w-full min-w-0 rounded-xl border border-border bg-white px-3 ps-10 text-sm font-bold text-brand outline-none transition placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/10"
              dir="auto"
              onChange={(event) => setHotelQuery(event.target.value)}
              placeholder="نام هتل را وارد کنید"
              type="search"
              value={hotelQuery}
            />
            {hotelQuery ? (
              <button
                aria-label="پاک کردن جستجوی هتل"
                className="absolute start-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-lg font-black leading-none text-muted transition hover:bg-surface-muted hover:text-brand"
                onClick={() => setHotelQuery("")}
                type="button"
              >
                ×
              </button>
            ) : null}
          </span>
        </label>

        <form action="/hotels/" className="mt-5 grid min-w-0 gap-4 border-t border-border pt-5">
          <CountryCityFields key={country + selectedDestinationSlug} id="hotel" countries={countries} cities={cities.map((city) => ({ title: city.title, value: city.slug, country: city.country }))} country={country} city={selectedDestinationSlug} cityName="destinationSlug" />
          {passengerCount ? <input name="passengerCount" type="hidden" value={passengerCount} /> : null}
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-black text-white" type="submit">اعمال مقصد</button>
        </form>

        <fieldset className="mt-6 border-t border-border pt-5">
          <legend className="text-base font-black text-brand">ستاره هتل</legend>
          <div className="mt-3 grid gap-2">
            {[5, 4, 3, 2, 1].map((star) => (
              <label
                className="flex cursor-pointer items-center justify-between rounded-xl px-2 py-2 transition hover:bg-sky-50"
                key={star}
              >
                <input
                  checked={selectedStars.includes(star)}
                  className="size-5 accent-brand"
                  onChange={() => toggleStar(star)}
                  type="checkbox"
                />
                <HotelStars rating={star} />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid gap-2 border-t border-border pt-5 text-sm font-black text-brand">
          <span>مرتب‌سازی</span>
          <SiteSelect
            ariaLabel="مرتب‌سازی هتل‌ها"
            className="min-h-12"
            id="hotel-sort"
            onValueChange={setSort}
            options={[{ label: "پیشنهادی", value: "recommended" }, { label: "بیشترین ستاره", value: "stars-desc" }]}
            value={sort}
          />
        </div>

        <p className="mt-5 rounded-xl bg-surface-muted p-3 text-xs leading-6 text-muted">
          {visibleHotels.length.toLocaleString("fa-IR")} هتل مطابق فیلترها پیدا
          شد.
        </p>
        </ResponsiveFilterPanel>
      </aside>

      <div className="min-w-0">
        <div className="mb-5 rounded-2xl border border-border bg-white/85 p-3 shadow-[0_8px_24px_rgba(1,37,105,.06)] sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div><p className="text-sm font-black text-brand">هتل‌های پیشنهادی</p><p className="mt-1 text-xs text-muted">{visibleHotels.length.toLocaleString("fa-IR")} گزینه با فیلترهای فعلی</p></div>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
            {hotelQuery ? <button className="rounded-full bg-[#fff1f7] px-3 py-1 text-xs font-bold text-[#c72169]" onClick={() => setHotelQuery("")} type="button">نام هتل: {hotelQuery} ×</button> : null}
            {selectedStars.map((star) => <button className="rounded-full bg-[#fff1f7] px-3 py-1 text-xs font-bold text-[#c72169]" key={star} onClick={() => toggleStar(star)} type="button">{star.toLocaleString("fa-IR")} ستاره ×</button>)}
            {sort !== "recommended" ? <button className="rounded-full bg-[#fff1f7] px-3 py-1 text-xs font-bold text-[#c72169]" onClick={() => setSort("recommended")} type="button">مرتب‌سازی ×</button> : null}
            {(hotelQuery || selectedStars.length || sort !== "recommended") ? <button className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted hover:text-danger" onClick={() => { setHotelQuery(""); setSelectedStars([]); setSort("recommended"); }} type="button">پاک کردن همه</button> : null}
          </div>
        </div>
        {visibleHotels.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {visibleHotels.map((hotel) => (
              <HotelCard
                address={hotel.address}
                region={hotel.region}
                country={hotel.destination.country}
                countryFlagImageId={countryFlagImageIds[normalizeCountryName(hotel.destination.country)] ?? null}
                destination={hotel.destination.title}
                guestRating={hotel.guestRating}
                imageUrl={
                  hotel.imageId
                    ? `${PUBLIC_API_BASE_URL}/media/${hotel.imageId}`
                    : null
                }
                key={hotel.id}
                name={hotel.name}
                slug={hotel.slug}
                starRating={hotel.starRating}
                summary={hotel.summary}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description="نام هتل یا تعداد ستاره‌ها را تغییر دهید."
            title="هتلی مطابق فیلترهای انتخابی پیدا نشد"
          />
        )}
      </div>
    </div>
  );
}
