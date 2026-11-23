import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CountryFlag } from "@/components/content/country-flag";
import { PageIntro } from "@/components/layout/page-intro";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { createCountryImageMap, normalizeCountryName } from "@/lib/country-name";

export const metadata: Metadata = {
  title: "مقاصد گردشگری",
  alternates: { canonical: "/destinations/" },
};

type Destination = {
  id: number; title: string; slug: string; country: string; city: string | null;
  summary: string; imageId: number | null; isFeatured: boolean;
};
type Country = {
  id: number; name: string; slug: string; imageId: number | null;
};

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; search?: string }>;
}) {
  const { country, search = "" } = await searchParams;
  const normalizedSearch = search.trim().toLocaleLowerCase("fa-IR");
  const [payload, countryPayload] = await Promise.all([
    apiGet<{ items: Destination[] }>("/destinations?pageSize=100", { cache: "no-store" }).catch(() => ({ items: [] })),
    apiGet<{ items: Country[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
  ]);
  const countryFilters = [...countryPayload.items];
  const knownCountries = new Set(countryFilters.map((item) => item.name.trim()));
  for (const destination of payload.items) {
    const countryName = destination.country.trim();
    if (!countryName || knownCountries.has(countryName)) continue;
    countryFilters.push({
      id: -destination.id,
      name: countryName,
      slug: countryName,
      imageId: destination.imageId,
    });
    knownCountries.add(countryName);
  }
  const visibleDestinations = payload.items.filter((item) => {
    const matchesCountry = !country || item.country === country;
    const matchesSearch = !normalizedSearch || [item.title, item.city, item.country]
      .filter((value): value is string => Boolean(value?.trim()))
      .some((value) => value.toLocaleLowerCase("fa-IR").includes(normalizedSearch));
    return matchesCountry && matchesSearch;
  });
  const countryFlagImageIds = createCountryImageMap(countryFilters);
  return <><PageIntro title="مقاصد گردشگری" description="مقصدهای منتشرشده را بررسی و راهنمای کامل هر شهر و کشور را مطالعه کنید." />
    <section className="py-12 sm:py-16"><Container>
      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-2xl font-black">فیلتر بر اساس کشور</h2>{country ? <Link className="font-bold text-brand" href="/destinations/">نمایش همه</Link> : null}</div>
        <form action="/destinations/" className="mb-5 flex max-w-xl gap-2">
          <input aria-label={"\u062c\u0633\u062a\u200c\u0648\u062c\u0648\u06cc \u0634\u0647\u0631"} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-4 text-sm font-bold outline-none transition focus:border-brand focus:ring-4 focus:ring-accent" defaultValue={search} name="search" placeholder={"\u0646\u0627\u0645 \u0634\u0647\u0631 \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f"} />
          <button className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-strong" type="submit">{"\u062c\u0633\u062a\u200c\u0648\u062c\u0648"}</button>
        </form>
        <div className="-mx-4 flex flex-nowrap gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:mx-0 sm:px-0">
          {countryFilters.map((item) => <Link className={`group w-40 shrink-0 overflow-hidden rounded-[1.6rem] border bg-white/75 ring-1 ring-brand/5 backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-2 hover:border-accent-strong/45 hover:shadow-[0_20px_44px_rgba(1,37,105,.16)] sm:w-44 ${normalizeCountryName(country) === normalizeCountryName(item.name) ? "border-brand ring-4 ring-brand/15" : "border-white/80"}`} href={`/destinations/?country=${encodeURIComponent(normalizeCountryName(item.name))}`} key={`${item.id}-${item.name}`} scroll={false}>
            <div className="relative aspect-[4/3] bg-surface-muted">{item.imageId ? <Image alt={normalizeCountryName(item.name)} className="object-cover transition duration-700 ease-out group-hover:scale-110" fill sizes="176px" src={`${PUBLIC_API_BASE_URL}/media/${item.imageId}`} /> : null}</div>
            <p className="mx-3 mb-3 -mt-3 relative z-10 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-center text-base font-black text-brand shadow-[0_8px_24px_rgba(1,37,105,.14)] backdrop-blur-md transition group-hover:bg-accent">{normalizeCountryName(item.name)}</p>
          </Link>)}
        </div>
      </div>
      {country ? <p className="mb-6 text-lg font-bold">مقاصد کشور {country}</p> : null}
      {visibleDestinations.length ? <ResponsiveGrid>{visibleDestinations.map((item) => <Card as="article" className="group overflow-hidden rounded-[1.75rem] border-white/80 bg-white/75 p-0 ring-1 ring-brand/5 backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-2 hover:border-accent-strong/45 hover:shadow-[0_24px_58px_rgba(1,37,105,.17)] focus-within:ring-4 focus-within:ring-accent" key={item.id}>
        <div className="relative aspect-square bg-brand">{item.imageId ? <Image alt={item.title} className="object-cover transition duration-700 ease-out group-hover:scale-110" fill sizes="(max-width:640px) 100vw, 33vw" src={`${PUBLIC_API_BASE_URL}/media/${item.imageId}`} /> : null}</div>
        <div className="p-5"><p className="inline-flex items-center gap-2 rounded-full border border-accent-strong/20 bg-accent/65 px-3 py-1.5 text-sm font-black text-brand shadow-sm transition group-hover:bg-accent"><CountryFlag country={item.country} imageId={countryFlagImageIds.get(normalizeCountryName(item.country)) ?? null} />{item.country}{item.city ? `، ${item.city}` : ""}</p><h2 className="mt-2 text-2xl font-black">{item.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-7 text-muted">{item.summary}</p><Link className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-brand/15 bg-white/70 px-4 font-black text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent" href={`/destinations/${item.slug}/`}>مشاهده مقصد ←</Link></div>
      </Card>)}</ResponsiveGrid> : <EmptyState title="هنوز مقصدی منتشر نشده است" description="مقصدهای منتشرشده در پنل مدیریت اینجا نمایش داده می‌شوند." />}
    </Container></section>
  </>;
}
