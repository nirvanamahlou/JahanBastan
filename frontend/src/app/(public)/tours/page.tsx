import { CountryCityFields } from "@/components/content/country-city-fields";
import { getDepartures, hotelImages } from "./departures/catalog";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { TourResultRow } from "@/components/content/tour-result-row";
import { CountryFlag as Flag } from "@/components/content/country-flag";
import styles from "@/components/content/catalog-layout.module.css";
import { JalaliDateRangeInput } from "@/components/search/jalali-date-range-input";
import { SearchIcon } from "@/components/layout/site-icons";
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

const transportationModes = [
  { value: "flight", label: "همه پروازها", aliases: ["flight", "plane", "airplane", "پرواز", "هواپیما"] },
  { value: "bus", label: "همه اتوبوس‌ها", aliases: ["bus", "اتوبوس"] },
  { value: "train", label: "همه قطارها", aliases: ["train", "rail", "railway", "قطار"] },
] as const;

const valueOf = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

function normalizedTransportation(value: string) {
  return value.trim().toLocaleLowerCase("fa-IR").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
}

function transportationOptions(options: FilterOption[]) {
  const modes = transportationModes
    .filter((mode) => options.some((option) => {
      const value = normalizedTransportation(option.value);
      return mode.aliases.some((alias) => value === alias || value.includes(alias));
    }))
    .map(({ label, value }) => ({ label, value }));
  return Array.from(new Map([...modes, ...options].map((option) => [option.value, option])).values());
}

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
  const country = normalizeCountryName(valueOf(raw.country));
  const destination = valueOf(raw.destination);
  const departure = valueOf(raw.departure);
  const transportation = valueOf(raw.transportation);
  const tourType = valueOf(raw.tourType);
  const airline = valueOf(raw.airline);
  const hotelStars = valueOf(raw.hotelStars);
  const departureFrom = valueOf(raw.departureFrom);
  const departureTo = valueOf(raw.departureTo);
  const passengerCount = valueOf(raw.passengerCount);
  const minPrice = valueOf(raw.minPrice);
  const maxPrice = valueOf(raw.maxPrice);
  const featured = valueOf(raw.featured) === "true";
  const installmentOnly = valueOf(raw.installmentOnly) === "true";
  const directFlight = valueOf(raw.directFlight) === "true";
  const lastMinute = valueOf(raw.lastMinute) === "true";
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
  if (transportation) apiParams.set("transportation", transportation);
  if (tourType) apiParams.set("tourType", tourType);
  if (airline) apiParams.set("airline", airline);
  if (hotelStars) apiParams.set("hotelStars", hotelStars);
  if (departureFrom) apiParams.set("departureFrom", departureFrom);
  if (departureTo) apiParams.set("departureTo", departureTo);
  if (passengerCount) apiParams.set("passengerCount", passengerCount);
  if (minPrice) apiParams.set("minPrice", minPrice);
  if (maxPrice) apiParams.set("maxPrice", maxPrice);
  if (featured) apiParams.set("featured", "true");
  if (installmentOnly) apiParams.set("installmentOnly", "true");
  if (directFlight) apiParams.set("directFlight", "true");
  if (lastMinute) apiParams.set("lastMinute", "true");

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
    if (airline && ![tour.outbound.carrierName,tour.returning?.carrierName].some(name => normalize(name) === normalize(airline))) continue;
    if (hotelStars && !tour.hotels.some(h => Number(h.starRating) === Number(hotelStars))) continue;
    if (transportation && !(transportationModes[0].aliases as readonly string[]).includes(transportation)) continue;
    if (tourType || featured || lastMinute || directFlight || installmentOnly) continue;
    const date = tour.startsOn.slice(0,10);
    if ((departureFrom && date < departureFrom) || (departureTo && date > departureTo)) continue;
    if (passengerCount && (tour.salesStopped || tour.previewOnly || (tour.remainingCapacity !== null && tour.remainingCapacity < Number(passengerCount)))) continue;
    const offers = tour.rates.filter(rate => rate.kind === "double").map(rate => rate.total);
    const comparable = offers.length > 0 && offers.every(parts => parts.length === 1 && parts[0].currencyCode === offers[0][0]?.currencyCode);
    const price = comparable ? Math.min(...offers.map(parts => Number(parts[0].amount))) : null;
    if ((minPrice || maxPrice) && (price === null || (minPrice && price < Number(minPrice)) || (maxPrice && price > Number(maxPrice)))) continue;
    external.push({
      id:tour.id, slug:"departures/"+tour.id, title:tour.title, summary:tour.details?.summary || tour.description || null,
      imageId:null, imageUrl:tour.hotels.flatMap(hotelImages)[0], destination:{title:city,country:places[0]?.country.name || ""},
      durationDays:Math.round((Date.parse(tour.endsOn)-Date.parse(tour.startsOn))/86400000)+1,
      departureDate:date, origin:tour.outbound.originName, priceAmount:price === null ? null : String(price),
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
  const availableTransportations = transportationOptions(options.transportations);
  const current = new URLSearchParams();
  ["country", "search", "destination", "departure", "transportation", "tourType", "airline", "hotelStars", "departureFrom", "departureTo", "passengerCount", "minPrice", "maxPrice", "featured", "installmentOnly", "directFlight", "lastMinute", "sort"]
    .forEach((key) => {
      const value = valueOf(raw[key]);
      if (value) current.set(key, value);
    });
  const pageCount = Math.max(1, Math.ceil(payload.total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const hasFilters = Boolean(country || search || destination || departure || transportation || tourType || airline || hotelStars || departureFrom || departureTo || passengerCount || minPrice || maxPrice || featured || installmentOnly || directFlight || lastMinute);

  const destinationLabel = options.destinations.find((option) => option.value === destination)?.label;
  const heading = destinationLabel ? `تورهای ${destinationLabel}` : country ? `تورهای ${country}` : "تورهای داخلی و خارجی";
  const countryHref = country ? hrefWith(new URLSearchParams(), { country }) : "/tours/";
  const countryPhoto = country ? destinations.items.find(item => normalizeCountryName(item.country) === country && item.imageId)?.imageId : null;
  const field = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-brand outline-none transition focus:border-accent-strong focus:ring-4 focus:ring-accent/30";
  return <section className={country ? styles.countryPage : "bg-white pt-2 pb-8 sm:pt-3 sm:pb-12"}><Container className={country ? styles.countryContainer : styles.tourContainer}>
    {country ? <header className={styles.countryHero}>
      {countryPhoto && <div className={styles.countryHeroPhoto}><Image src={`${PUBLIC_API_BASE_URL}/media/${countryPhoto}`} alt="" fill sizes="(max-width:640px) 95vw, 520px" /></div>}
      <div className={styles.countryHeroCopy}>
        <Link href="/#tour-countries">← همه کشورها</Link>
        <div className={styles.countryHeroTitle}><Flag country={country} imageId={countryFlagIds.get(country)} /><h1>{heading}</h1></div>
        <p>{payload.total.toLocaleString("fa-IR")} تور برای این انتخاب</p>
      </div>
    </header> : <>
      <header className={styles.heading}><div><h1>{heading}</h1><p>{payload.total.toLocaleString("fa-IR")} تور منتشرشده</p></div><Link className="ms-auto shrink-0 text-sm font-bold text-brand" href="/#tour-countries">← همه کشورها</Link></header>
      <Link href="/tours/departures/" className="mb-4 inline-flex rounded-xl bg-brand px-4 py-3 font-bold text-white">تورهای تاریخ‌دار</Link>
    </>}
    <div className={country ? styles.countryLayout : undefined}>
    <form action="/tours/" className={styles.tourSearch} aria-label="جست‌وجوی تور">
        <div className={styles.tourSearchFields}>
          <div className={styles.field}><span>مبدأ</span><SiteSelect ariaLabel="مبدأ" defaultValue={departure} id="tour-origin" name="departure" options={[{ label: "همه مبدأها", value: "" }, ...options.origins]} searchable /></div>
          <CountryCityFields key={country + destination} id="tour" countries={countries.items} cities={destinations.items.map((item) => ({ title: item.title, value: item.slug, country: item.country }))} country={country} city={destination} />
          <div className={`${styles.field} ${styles.tourSearchDates}`}><JalaliDateRangeInput key={`${departureFrom}:${departureTo}`} compact initialDeparture={departureFrom || null} initialReturn={departureTo || null} showTripType={false} dateLabels={{ field: "بازهٔ تاریخ حرکت", departure: "از تاریخ", return: "تا تاریخ" }} /></div>
          <label>تعداد مسافر<input className={field} defaultValue={passengerCount} min={1} max={20} name="passengerCount" type="number" /></label>
          <button type="submit" className={styles.tourSearchButton}><SearchIcon className="size-4" />جست‌وجوی تور</button>
        </div>
        <details className={styles.tourSearchAdvanced} open={Boolean(airline || hotelStars || tourType || transportation || minPrice || maxPrice || search || featured || installmentOnly || directFlight || lastMinute)}>
          <summary>فیلترهای بیشتر</summary>
          <div className={styles.tourSearchExtras}>
          <div className={styles.field}><span>ایرلاین</span><SiteSelect ariaLabel="ایرلاین" defaultValue={airline} id="tour-airline" name="airline" options={[{ label: "همه ایرلاین‌ها", value: "" }, ...options.airlines]} searchable /></div>
          <div className={styles.field}><span>درجه هتل</span><SiteSelect ariaLabel="درجه هتل" defaultValue={hotelStars} id="tour-hotel-stars" name="hotelStars" options={[{ label: "همه", value: "" }, ...options.hotelStars]} /></div>
          <div className={styles.field}><span>نوع خدمات</span><SiteSelect ariaLabel="نوع خدمات" defaultValue={tourType} id="tour-service-type" name="tourType" options={[{ label: "همه خدمات", value: "" }, ...options.tourTypes]} /></div>
          <div className={styles.field}><span>وسیله سفر</span><SiteSelect ariaLabel="وسیله سفر" defaultValue={transportation} id="tour-transportation" name="transportation" options={[{ label: "همه", value: "" }, ...availableTransportations]} /></div>
          <fieldset className="grid min-w-0 grid-cols-2 gap-2"><legend className="mb-2 text-sm font-bold">محدوده قیمت</legend><label>از<input aria-label="حداقل قیمت" className={field} defaultValue={minPrice} min={0} name="minPrice" type="number" /></label><label>تا<input aria-label="حداکثر قیمت" className={field} defaultValue={maxPrice} min={0} name="maxPrice" type="number" /></label></fieldset>
          <label>نام تور<input className={field} defaultValue={search} minLength={2} name="search" placeholder="نام تور یا مقصد" type="search" /></label>
          <fieldset className="grid gap-3 border-t border-border pt-4"><legend className="sr-only">ویژگی‌های تور</legend>{[["featured", "فقط پرفروش", featured], ["installmentOnly", "خرید اقساطی", installmentOnly], ["directFlight", "پرواز مستقیم", directFlight], ["lastMinute", "لحظه‌آخری", lastMinute]].map(([name, label, checked]) => <label key={String(name)} className="!flex items-center gap-2"><input defaultChecked={Boolean(checked)} name={String(name)} type="checkbox" value="true" />{label}</label>)}</fieldset>
          </div>
        </details>
        <input type="hidden" name="sort" value={sort} />
        {hasFilters ? <Link className="mt-2 inline-block text-xs font-bold text-muted" href={countryHref}>پاک کردن فیلترها</Link> : null}
    </form>
      <div className={styles.content}>
        <div className={styles.sort}><span className="text-sm text-muted">{payload.total.toLocaleString("fa-IR")} تور موجود</span><form action="/tours/">{Array.from(current.entries()).filter(([key]) => key !== "sort").map(([key, value]) => <input key={key} name={key} type="hidden" value={value} />)}<label className="text-xs text-muted" htmlFor="tour-sort">مرتب‌سازی</label><SiteSelect ariaLabel="مرتب‌سازی تورها" defaultValue={sort} id="tour-sort" name="sort" options={sortOptions} /><button className="rounded-lg border border-border p-2 text-sm" type="submit">اعمال</button></form></div>
        <section className={country ? styles.countryResults : styles.results} aria-label="فهرست تورها">
          {payload.items.length ? payload.items.map((tour) => {
            const price = tour.priceAmount ? formatCurrency(tour.priceAmount, tour.currency) : null;
            return <TourResultRow
              key={tour.slug}
              title={tour.title}
              slug={tour.slug}
              summary={tour.summary}
              imageUrl={tour.imageUrl || (tour.imageId ? `${PUBLIC_API_BASE_URL}/media/${tour.imageId}` : null)}
              destination={tour.destination?.title ?? "با استعلام"}
              date={tour.departureDate ? formatPersianDate(tour.departureDate) : "با استعلام"}
              duration={tour.durationDays}
              airline={tour.airlineName || tour.transportation || "با استعلام"}
              price={price ?? "استعلام قیمت"}
              countryDates={country ? { native: !tour.slug.startsWith("departures/"), departure: tour.departureDate, returning: tour.returnDate ?? null, price } : undefined}
            />;
          }) : <EmptyState title="توری با این فیلترها پیدا نشد" description="فیلترها را تغییر دهید یا همه را پاک کنید." action={<Link href="/tours/">همه تورها</Link>} />}
        </section>
        {pageCount > 1 ? <nav aria-label="صفحه‌بندی تورها" className="mt-8 flex flex-wrap justify-center gap-2">{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <Link aria-current={number === page ? "page" : undefined} className={`grid size-11 place-items-center rounded-xl border text-sm font-black ${number === page ? "bg-brand text-white" : "text-brand"}`} href={hrefWith(current, { page: String(number) })} key={number}>{number.toLocaleString("fa-IR")}</Link>)}</nav> : null}
      </div>
    </div>
  </Container></section>;
}
