import { FooterNewsletter } from "@/components/layout/footer-newsletter";
import { getDepartures, hotelImages } from "./departures/catalog";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { TourResultRow } from "@/components/content/tour-result-row";
import { TourSortSelect } from "@/components/content/tour-sort-select";
import { CountryFlag as Flag } from "@/components/content/country-flag";
import styles from "@/components/content/catalog-layout.module.css";
import { JalaliDateRangeInput } from "@/components/search/jalali-date-range-input";
import { LocationIcon, SearchIcon } from "@/components/layout/site-icons";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteSelect } from "@/components/ui/site-select";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { createCountryImageMap, normalizeCountryName } from "@/lib/country-name";
import { formatPersianDate } from "@/lib/persian-date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "تورهای داخلی و خارجی | قیمت و رزرو",
  description: "قیمت، مقایسه و رزرو تورهای داخلی و خارجی جهان باستان؛ بررسی مقصد، تاریخ حرکت، هتل، پرواز و خدمات سفر.",
  alternates: { canonical: "/tours/" },
};

type ApiTour = {
  id: number | string;
  imageUrl?: string;
  slug: string;
  title: string;
  origin: string | null;
  durationDays: number | null;
  departureDate: string | null;
  returnDate?: string | null;
  priceAmount: string | null;
  displayPrice?: string;
  currency: string | null;
  transportation: string | null;
  airlineName: string | null;
  tourType: string | null;
  summary: string | null;
  destination: { title: string; country: string } | null;
  hotel: { starRating: number } | null;
  imageId: number | null;
  isFeatured: boolean;
  isInstallmentAvailable: boolean;
  isDirectFlight: boolean;
  isLastMinute: boolean;
  badgeLabel: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;
type FilterOption = { label: string; value: string };
type CountryFlag = { name: string; imageId: number | null };
type FilterOptions = {
  destinations: FilterOption[];
  origins: FilterOption[];
  tourTypes: FilterOption[];
  transportations: FilterOption[];
  airlines: FilterOption[];
  hotelStars: FilterOption[];
};

const PAGE_SIZE = 12;
const sortOptions = [
  { label: "پیشنهادی", value: "featured" },
  { label: "ارزان‌ترین", value: "price-asc" },
  { label: "گران‌ترین", value: "price-desc" },
  { label: "نزدیک‌ترین تاریخ", value: "departure" },
] as const;

const valueOf = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

function hrefWith(current: URLSearchParams, updates: Record<string, string | null>) {
  const next = new URLSearchParams(current);
  next.delete("page");
  Object.entries(updates).forEach(([key, value]) => {
    if (value) next.set(key, value);
    else next.delete(key);
  });
  const query = next.toString();
  return query ? `/tours/?${query}` : "/tours/";
}

export default async function ToursPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const search = valueOf(raw.search).trim();
  const place = valueOf(raw.place);
  const country = normalizeCountryName(place.startsWith("country:") ? place.slice(8) : place ? "" : valueOf(raw.country));
  const destination = place.startsWith("city:") ? place.slice(5) : place ? "" : valueOf(raw.destination);
  const departure = valueOf(raw.departure);
  const departureFrom = valueOf(raw.departureFrom);
  const departureTo = valueOf(raw.departureTo);
  const passengerCount = valueOf(raw.passengerCount);
  const requestedSort = valueOf(raw.sort) || "featured";
  const sort = sortOptions.some((item) => item.value === requestedSort) ? requestedSort : "featured";
  const requestedPage = Math.max(1, Number(valueOf(raw.page)) || 1);

  const apiParams = new URLSearchParams({
    pageSize: String(PAGE_SIZE),
    offset: String((requestedPage - 1) * PAGE_SIZE),
    sort,
  });
  if (search.length >= 2) apiParams.set("search", search);
  if (country) apiParams.set("country", country);
  if (destination) apiParams.set("destinationSlug", destination);
  if (departure) apiParams.set("origin", departure);
  if (departureFrom) apiParams.set("departureFrom", departureFrom);
  if (departureTo) apiParams.set("departureTo", departureTo);
  if (passengerCount) apiParams.set("passengerCount", passengerCount);

  const [nativePage, options, countries, destinations, departures] = await Promise.all([
    apiGet<{ items: ApiTour[]; total: number }>(`/tours?${apiParams}`, { cache: "no-store" })
      .catch(() => ({ items: [], total: 0 })),
    apiGet<FilterOptions>("/tours/filter-options", { cache: "no-store" })
      .catch(() => ({ destinations: [], origins: [], tourTypes: [], transportations: [], airlines: [], hotelStars: [] })),
    apiGet<{ items: CountryFlag[] }>("/countries", { cache: "no-store" })
      .catch(() => ({ items: [] })),
    apiGet<{ items: { slug: string; title: string; country: string; imageId?: number | null }[] }>("/destinations?pageSize=100", { cache: "no-store" }).catch(() => ({ items: [] })),
    getDepartures().catch(() => []),
  ]);
  const selected = destinations.items.find(city => city.slug === destination);
  const normalize = (name?: string) => (name || "").trim().replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/آ/g,"ا").toLowerCase();
  const external: ApiTour[] = [];
  for (const tour of departures) {
    const city = tour.outbound.destinationName;
    const places = tour.hotels.flatMap(h => h.city ? [h.city] : []);
    const names = [city, ...places.map(place => place.name)];
    if (destination && !names.some(name => normalize(name) === normalize(selected?.title || destination))) continue;
    if (country && !places.some(place => normalize(place.country.name) === normalize(country)) && !destinations.items.some(place => normalize(place.country) === normalize(country) && normalize(place.title) === normalize(city))) continue;
    if (search && ![tour.title,...names].some(name => normalize(name).includes(normalize(search)))) continue;
    if (departure && normalize(departure) !== normalize(tour.outbound.originName)) continue;
    const date = tour.startsOn.slice(0,10);
    if ((departureFrom && date < departureFrom) || (departureTo && date > departureTo)) continue;
    if (passengerCount && (tour.salesStopped || tour.previewOnly || (tour.remainingCapacity !== null && tour.remainingCapacity < Number(passengerCount)))) continue;
    const offers = tour.rates.filter(rate => rate.kind === "double").map(rate => rate.total);
    const comparable = offers.length > 0 && offers.every(parts => parts.length === 1 && parts[0].currencyCode === offers[0][0]?.currencyCode);
    const price = comparable ? Math.min(...offers.map(parts => Number(parts[0].amount))) : null;
    const formattedOffers = new Set(offers.filter((parts) => parts.length).map((parts) =>
      parts.map(({ amount, currencyCode }) => formatCurrency(String(amount), currencyCode)).join(" + "),
    ));
    const displayPrice = formattedOffers.size === 1 ? [...formattedOffers][0] : undefined;
    external.push({
      id:tour.id, slug:"departures/"+tour.id, title:tour.title, summary:tour.details?.summary || tour.description || null,
      imageId:null, imageUrl:normalize(city) === normalize("دبی") ? "/images/dubai-tour-cover.webp" : tour.hotels.flatMap(hotelImages)[0], destination:{title:city,country:places[0]?.country.name || ""},
      durationDays:Math.round((Date.parse(tour.endsOn)-Date.parse(tour.startsOn))/86400000)+1,
      departureDate:date, origin:tour.outbound.originName, priceAmount:price === null ? null : String(price), displayPrice,
      returnDate:tour.endsOn.slice(0,10),
      currency:comparable ? offers[0][0].currencyCode : null, airlineName:tour.outbound.carrierName,
      transportation:"پرواز", tourType:null, hotel:null, badgeLabel:null, isFeatured:false, isDirectFlight:false, isLastMinute:false, isInstallmentAvailable:false,
    });
  }
  let payload = nativePage;
  if (external.length) {
    const total = nativePage.total + external.length;
    const offset = (Math.min(requestedPage, Math.ceil(total/PAGE_SIZE))-1)*PAGE_SIZE;
    const from = Math.max(0,offset-external.length);
    const end = Math.min(nativePage.total,offset+PAGE_SIZE);
    const requests = [];
    for (let i=from; i<end; i+=100) {
      const query = new URLSearchParams(apiParams);
      query.set("offset",String(i));
      query.set("pageSize",String(Math.min(100,end-i)));
      requests.push(apiGet<{items:ApiTour[]}>("/tours?"+query,{cache:"no-store"}));
    }
    const native = (await Promise.all(requests)).flatMap(result => result.items);
    function rank(row:ApiTour) {
      if (sort === "departure") return row.departureDate ? Date.parse(row.departureDate) : Infinity;
      if (sort.startsWith("price-")) return row.priceAmount === null ? Infinity : Number(row.priceAmount)*(sort === "price-desc" ? -1 : 1);
      return typeof row.id === "string" ? -1 : 0;
    }
    const rows = [...native,...external].sort((a,b) => rank(a)-rank(b));
    payload = {items:rows.slice(offset-from,offset-from+PAGE_SIZE),total};
  }
  const countryFlagIds = createCountryImageMap(countries.items);
  const current = new URLSearchParams();
  for (const [key, value] of Object.entries({ country, search, destination, departure, departureFrom, departureTo, passengerCount, sort })) {
    if (value) current.set(key, value);
  }
  const pageCount = Math.max(1, Math.ceil(payload.total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const hasFilters = Boolean(country || search || destination || departure || departureFrom || departureTo || passengerCount);

  const destinationLabel = options.destinations.find((option) => option.value === destination)?.label;
  const heading = destinationLabel ? `تورهای ${destinationLabel}` : country ? `تورهای ${country}` : "تورهای داخلی و خارجی";
  const countryPhoto = country ? destinations.items.find(item => normalizeCountryName(item.country) === country && item.imageId)?.imageId : null;
  return <section className={styles.countryPage}><Container className={styles.catalogContainer}>
    {country ? <header className={styles.countryHero}>
      {countryPhoto && <div className={styles.countryHeroPhoto}><Image src={`${PUBLIC_API_BASE_URL}/media/${countryPhoto}`} alt="" fill sizes="(max-width:640px) 95vw, 520px" /></div>}
      <div className={styles.countryHeroCopy}>
        <Link href="/#tour-countries">← همه کشورها</Link>
        <div className={styles.countryHeroTitle}><Flag country={country} imageId={countryFlagIds.get(country)} /><h1>{heading}</h1></div>
        <p>{payload.total.toLocaleString("fa-IR")} تور برای این انتخاب</p>
      </div>
    </header> : <>
      <header className={`${styles.heading} flex-wrap`}><div><h1>{heading}</h1><p>{payload.total.toLocaleString("fa-IR")} تور منتشرشده</p></div><Link className="ms-auto shrink-0 text-sm font-bold text-brand" href="/#tour-countries">← همه کشورها</Link></header>
      <Link href="/tours/departures/" className="mb-4 inline-flex rounded-xl bg-brand px-4 py-3 font-bold text-white">تورهای تاریخ‌دار</Link>
    </>}
    <div>
      {!country && <form action="/tours/" className={styles.tourSearch} aria-label="جست‌وجوی تور">
        <div className={styles.tourSearchFields}>
          <div className={styles.field}>
            <span><LocationIcon className="size-4" />مبدأ</span>
            <SiteSelect ariaLabel="مبدأ" defaultValue={departure} id="tour-origin" name="departure" options={[{ label: "همه مبدأها", value: "" }, ...options.origins]} searchable />
          </div>
          <div className={styles.field}>
            <span><LocationIcon className="size-4" />مقصد</span>
            <SiteSelect ariaLabel="مقصد" key={destination || country} defaultValue={destination ? `city:${destination}` : country ? `country:${country}` : ""} id="tour-destination" name="place" options={[
              { label: "همه مقصدها", value: "" },
              ...countries.items.map(({ name }) => ({ label: name, value: `country:${normalizeCountryName(name)}` })),
              ...destinations.items.map(({ title, slug, country: cityCountry }) => ({ label: cityCountry ? `${title}، ${cityCountry}` : title, value: `city:${slug}` })),
            ]} searchable />
          </div>
          <div className={styles.tourSearchDates}>
            <JalaliDateRangeInput key={`${departureFrom}:${departureTo}`} compact initialDeparture={departureFrom || null} initialReturn={departureTo || null} showTripType={false} dateLabels={{ field: "بازهٔ تاریخ حرکت", departure: "از تاریخ", return: "تا تاریخ" }} />
          </div>
          <label className={styles.tourSearchPassengers}>
            <span>تعداد مسافر</span>
            <input defaultValue={passengerCount} min={1} max={20} name="passengerCount" placeholder="تعداد نفرات" type="number" />
          </label>
          <button type="submit" className={styles.tourSearchButton}><SearchIcon className="size-4" />جست‌وجوی تور</button>
        </div>
        <input type="hidden" name="sort" value={sort} />
        {hasFilters && <Link className={styles.tourSearchReset} href="/tours/">پاک کردن فیلترها</Link>}
      </form>}
      <div className={styles.content}>
        <div className={styles.sort}>
          <span className="text-sm text-muted">{payload.total.toLocaleString("fa-IR")} تور موجود</span>
          <TourSortSelect value={sort} options={sortOptions.map((option) => ({
            ...option,
            href: hrefWith(current, { sort: option.value }),
          }))} />
        </div>
        <section className={styles.countryResults} aria-label="فهرست تورها">
          {payload.items.length ? payload.items.map((tour) => {
            const price = tour.displayPrice ?? (tour.priceAmount ? formatCurrency(tour.priceAmount, tour.currency) : null);
            return <TourResultRow
              key={tour.slug}
              title={tour.title}
              slug={tour.slug}
              imageUrl={tour.imageUrl || (tour.imageId ? `${PUBLIC_API_BASE_URL}/media/${tour.imageId}` : null)}
              destination={tour.destination?.title ?? "با استعلام"}
              date={tour.departureDate ? formatPersianDate(tour.departureDate) : "با استعلام"}
              duration={tour.durationDays}
              airline={tour.airlineName?.trim() || "با استعلام"}
              price={price ?? "استعلام قیمت"}
              countryLayout={Boolean(country)}
              dateRanges={{ native: !tour.slug.startsWith("departures/"), departure: tour.departureDate, returning: tour.returnDate ?? null, price }}
            />;
          }) : <EmptyState title="توری با این فیلترها پیدا نشد" description="فیلترها را تغییر دهید یا همه را پاک کنید." action={<Link href="/tours/">همه تورها</Link>} />}
        </section>
        {pageCount > 1 ? <nav aria-label="صفحه‌بندی تورها" className="mt-8 flex flex-wrap justify-center gap-2">{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <Link aria-current={number === page ? "page" : undefined} className={`grid size-11 place-items-center rounded-xl border text-sm font-black ${number === page ? "bg-brand text-white" : "text-brand"}`} href={hrefWith(current, { page: String(number) })} key={number}>{number.toLocaleString("fa-IR")}</Link>)}</nav> : null}
      </div>
    </div>
  </Container>
    <div className="mt-8"><FooterNewsletter /></div>
  </section>;
}
