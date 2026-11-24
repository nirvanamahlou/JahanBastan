import { ResponsiveFilterPanel } from "@/components/content/responsive-filter-panel";
import { CountryDirectory } from "@/components/content/country-directory";
import { CountryCityFields } from "@/components/content/country-city-fields";
import catalogStyles from "@/components/content/catalog-layout.module.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RefundPolicyButton } from "@/components/content/refund-policy-button";
import { CountryFlag } from "@/components/content/country-flag";
import { type TicketDestinationChoice } from "@/components/content/ticket-destination-picker";
import { TicketSelectionProvider } from "@/components/content/ticket-selection-provider";
import { TransportGuide } from "@/components/content/transport-guide";
import { TransportResultCard } from "@/components/content/transport-result-card";
import { TransportDateStrip } from "@/components/content/transport-date-strip";
import { AvailabilityNotice } from "@/components/content/availability-notice";
import { PageIntro } from "@/components/layout/page-intro";
import { BusIcon, TrainIcon } from "@/components/layout/site-icons";
import { JalaliDateRangeInput } from "@/components/search/jalali-date-range-input";
import { PriceRangeFilter } from "@/components/search/price-range-filter";
import { SearchableRouteSelect } from "@/components/search/searchable-route-select";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteSelect } from "@/components/ui/site-select";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { createCountryImageMap, normalizeCountryName } from "@/lib/country-name";

export const metadata: Metadata = {
  title: "خدمات سفر",
  alternates: { canonical: "/services/" },
};

type Service = {
  id: number;
  title: string;
  slug: string;
  serviceType: string;
  summary: string;
  imageId: number | null;
  origin: string | null;
  country: string | null;
  destinationName: string | null;
  departureDate: string | null;
  returnDate: string | null;
  departureTime: string | null;
  returnTime: string | null;
  returnArrivalTime: string | null;
  arrivalTime: string | null;
  baggageAllowance: string | null;
  providerCompany: string | null;
  providerIconImageId: number | null;
  originTerminal: string | null;
  destinationTerminal: string | null;
  transportClass: string | null;
  tripType: "one_way" | "round_trip" | null;
  refundPolicy: string | null;
  basePrice: string | null;
  currency: string;
  compartmentType: "regular" | "private" | null;
  passengerCategory: "all" | "women" | "men" | null;
  carTransport: boolean;
  availableSeats: number | null;
  isFeatured: boolean;
};

type Destination = { country: string; id: number; title: string; city: string | null; imageId: number | null };
type Country = { name: string; imageId: number | null };

type SearchParams = {
  type?: string;
  visaType?: string;
  origin?: string;
  destination?: string;
  country?: string;
  departureFrom?: string;
  departureTo?: string;
  tripType?: string;
  compartmentType?: string;
  passengerCategory?: string;
  carTransport?: string;
  provider?: string;
  timeSlot?: string;
  availableOnly?: string;
  featured?: string;
  transportClass?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  showResults?: string;
};

const serviceTypes = [
  { value: "", label: "همه خدمات" },
  { value: "flight", label: "هواپیما" },
  { value: "train", label: "قطار" },
  { value: "bus", label: "اتوبوس" },
  { value: "hotel", label: "هتل" },
  { value: "visa", label: "ویزا" },
  { value: "other", label: "سایر" },
] as const;

const serviceLabels: Record<string, string> = {
  flight: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
  hotel: "هتل",
  visa: "ویزا",
  other: "سایر",
};

const control =
  "min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-bold text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-accent";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;
  // Ignore stale return data as soon as the visitor selects a one-way trip.
  const params = rawParams.tripType === "one_way"
    ? { ...rawParams, departureTo: undefined }
    : rawParams;
  const selectedType = serviceTypes.some((item) => item.value === params.type)
    ? (params.type ?? "")
    : "";
  // Train and bus use the same round-trip selection model as flights. Keep the
  // search controls' existing default in sync with the result state when the
  // URL does not yet include an explicit trip type.
  const tripType = params.tripType === "one_way" ? "one_way" : "round_trip";
  if (selectedType === "flight") {
    const flightQuery = new URLSearchParams();
    for (const key of ["country", "showResults", "origin", "destination", "departureFrom", "departureTo", "tripType"] as const) {
      if (params[key]) flightQuery.set(key, params[key]);
    }
    redirect(`/services/flights/${flightQuery.size ? `?${flightQuery}` : ""}`);
  }

  const isTransport = selectedType === "train" || selectedType === "bus";
  const isVisa = selectedType === "visa";
  const shouldShowTransportResults = isTransport && (params.showResults === "1" || Boolean(params.country));

  const query = new URLSearchParams({
    pageSize: "100",
    sort: params.sort || "recommended",
  });
  if (selectedType) query.set("type", selectedType);
  for (const [key, value] of Object.entries(params)) {
    if (key !== "type" && key !== "sort" && key !== "tripType" && key !== "showResults" && value) query.set(key, value);
  }
  const emptyServicePayload = { items: [] as Service[], total: 0 };
  const transportCatalogQuery = new URLSearchParams({ pageSize: "100", type: selectedType });
  const shouldLoadReturnTickets =
    shouldShowTransportResults &&
    tripType === "round_trip" &&
    Boolean(params.origin && params.destination);
  const returnQuery = new URLSearchParams(query);
  if (shouldLoadReturnTickets) {
    returnQuery.delete("country");
    returnQuery.set("origin", params.destination ?? "");
    returnQuery.set("destination", params.origin ?? "");
    if (params.departureTo) {
      returnQuery.set("departureFrom", params.departureTo);
      returnQuery.set("departureTo", params.departureTo);
    } else {
      returnQuery.delete("departureFrom");
      returnQuery.delete("departureTo");
    }
  }

  const [payload, returnPayload, transportCatalogPayload, settings, destinationPayload, faqPayload, countryPayload] = await Promise.all([
    !isTransport || shouldShowTransportResults
      ? apiGet<{ items: Service[]; total: number }>(`/services?${query}`, { cache: "no-store" })
          .catch(() => emptyServicePayload)
      : Promise.resolve(emptyServicePayload),
    shouldLoadReturnTickets
      ? apiGet<{ items: Service[]; total: number }>(`/services?${returnQuery}`, { cache: "no-store" })
          .catch(() => emptyServicePayload)
      : Promise.resolve(emptyServicePayload),
    isTransport
      ? apiGet<{ items: Service[]; total: number }>(`/services?${transportCatalogQuery}`, { cache: "no-store" })
          .catch(() => emptyServicePayload)
      : Promise.resolve(emptyServicePayload),
    apiGet<{ socialLinks: Record<string, string> }>("/settings", { cache: "no-store" })
      .catch(() => ({ socialLinks: {} })),
    apiGet<{ items: Destination[] }>("/destinations?pageSize=100", { cache: "no-store" })
      .catch(() => ({ items: [] })),
    apiGet<{ items: { id: number; question: string; answer: string }[] }>("/faqs?pageSize=6", { cache: "no-store" })
      .catch(() => ({ items: [] })),
    apiGet<{ items: Country[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
  ]);
  const countryFlagImageIds = createCountryImageMap(countryPayload.items);

  const transportTickets = Array.from(
    new Map(
      [
        ...payload.items.map((service) => ({
          service,
          direction: "outbound" as const,
          useReturnLeg: false,
        })),
        ...(tripType === "round_trip"
          ? payload.items
              .filter(
                (service) =>
                  service.tripType === "round_trip" &&
                  Boolean(
                    service.returnDate ||
                      service.returnTime ||
                      service.returnArrivalTime,
                  ),
              )
              .map((service) => ({
                service,
                direction: "return" as const,
                useReturnLeg: true,
              }))
          : []),
        ...(tripType === "round_trip"
          ? returnPayload.items.map((service) => ({
              service,
              direction: "return" as const,
              useReturnLeg: false,
            }))
          : []),
      ].map((ticket) => [
        `${ticket.service.id}-${ticket.direction}-${ticket.useReturnLeg ? "embedded" : "direct"}`,
        ticket,
      ]),
    ).values(),
  );

  const guideSettings: Record<string, string> = settings.socialLinks;
  const destinationImages = new Map<string, number | null>();
  for (const item of destinationPayload.items) {
    for (const name of [item.title, item.city].filter((value): value is string => Boolean(value?.trim()))) {
      destinationImages.set(name.trim().toLocaleLowerCase("fa-IR"), item.imageId);
    }
  }
  const transportOriginCounts = new Map<string, number>();
  const transportDestinationCounts = new Map<string, number>();
  if (isTransport) {
    for (const service of transportCatalogPayload.items) {
      const originName = (service.origin || "").trim();
      const destinationName = (service.destinationName || "").trim();
      if (originName) transportOriginCounts.set(originName, (transportOriginCounts.get(originName) ?? 0) + 1);
      if (destinationName) transportDestinationCounts.set(destinationName, (transportDestinationCounts.get(destinationName) ?? 0) + 1);
    }
  }
  const transportOriginOptions = [...transportOriginCounts]
    .map(([label, count]) => ({ label, value: label, description: `${count.toLocaleString("fa-IR")} سرویس موجود` }))
    .sort((first, second) => first.label.localeCompare(second.label, "fa"));
  const transportDestinationChoices: TicketDestinationChoice[] = [...transportDestinationCounts]
    .map(([label, ticketCount]) => ({
      label,
      ticketCount,
      imageId: destinationImages.get(label.toLocaleLowerCase("fa-IR")) ?? null,
    }))
    .sort((first, second) => second.ticketCount - first.ticketCount || first.label.localeCompare(second.label, "fa"));
  const transportDestinationOptions = transportDestinationChoices.map((item) => ({
    label: item.label,
    value: item.label,
    description: `${item.ticketCount.toLocaleString("fa-IR")} سرویس موجود`,
  }));
  const transportPriceValues = transportCatalogPayload.items.map((item) => Number(item.basePrice)).filter((value) => Number.isFinite(value) && value >= 0);
  const transportPriceMin = transportPriceValues.length ? Math.min(...transportPriceValues) : 0;
  const transportPriceMax = transportPriceValues.length ? Math.max(...transportPriceValues) : 10_000_000;
  const emptyStateIconId = Number(guideSettings["transportEmptyStateImageId"]) || null;
  const TransportIcon = selectedType === "train" ? TrainIcon : BusIcon;
  const transportLabel = selectedType === "train" ? "قطار" : "اتوبوس";
  const hasFilters = Boolean(
    params.origin || params.destination || params.departureFrom ||
    params.departureTo || params.provider || params.timeSlot ||
    params.availableOnly || params.transportClass || params.compartmentType ||
    params.passengerCategory || params.carTransport || params.featured || params.minPrice || params.maxPrice,
  );

  return (
    <>
      <PageIntro compact
        description={isTransport
          ? "مسیر، ساعت حرکت، شرکت حمل‌ونقل و ظرفیت را مقایسه کنید و بلیت مناسب را انتخاب کنید."
          : "خدمات منتشرشده را مستقیم از اطلاعات پنل مدیریت بررسی کنید."}
        title={isTransport ? `${transportLabel} ${params.country || "همه کشورها"}` : isVisa ? `ویزا ${params.country || "بر اساس کشور"}` : "خدمات سفر"}
      />
      <section className="py-10 sm:py-14">
        <Container className={catalogStyles.catalogContainer}>
          <nav aria-label="فیلتر نوع خدمت" className="mb-7 flex flex-wrap gap-2">
            {serviceTypes.map((item) => (
              <Link
                aria-current={selectedType === item.value ? "page" : undefined}
                className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-bold transition ${selectedType === item.value ? "border-brand bg-brand text-white" : "border-border bg-surface text-brand hover:-translate-y-0.5 hover:shadow-sm"}`}
                href={item.value ? `/services/?type=${item.value}` : "/services/"}
                key={item.value || "all"}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {isTransport ? (
            <div className={shouldShowTransportResults ? catalogStyles.layout : "w-full"}>
              {shouldShowTransportResults ? <aside data-mobile-filter-panel className={catalogStyles.sidebar}>
                <ResponsiveFilterPanel title="فیلترهای سفر">
                  <div className="mt-4 block xl:mt-0">
                    <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-brand">
                    <TransportIcon className="size-5" />
                    <h2 className="font-black">فیلترهای {transportLabel}</h2>
                  </div>
                  {hasFilters ? (
                    <Link className="text-xs font-black text-brand" href={`/services/?type=${selectedType}`}>
                      پاک کردن
                    </Link>
                  ) : null}
                </div>
                <form action="/services/" className="mt-5 space-y-4">
                  <input name="type" type="hidden" value={selectedType} />
                  <input name="showResults" type="hidden" value="1" />
                  <fieldset className="space-y-3 border-y border-border py-4">
                    <legend className="font-black">بازه قیمت</legend>
                    <PriceRangeFilter initialMin={params.minPrice} initialMax={params.maxPrice} minValue={transportPriceMin} maxValue={transportPriceMax} />
                  </fieldset>
                  <SearchableRouteSelect className={control} defaultValue={params.origin} id="transport-filter-origin" label="مبدأ" name="origin" options={transportOriginOptions} placeholder="شهر مبدأ" />
                  <CountryCityFields key={(params.country ?? "") + (params.destination ?? "")} id="transport" countries={countryPayload.items} country={params.country} city={params.destination} cities={transportDestinationOptions.map((item) => ({ title: item.label, value: item.value, country: transportCatalogPayload.items.find((service) => service.destinationName === item.value)?.country || destinationPayload.items.find((city) => city.title === item.value)?.country || "" }))} />
                  <JalaliDateRangeInput
                    compact
                    stackTripType
                    initialDeparture={params.departureFrom ?? null}
                    initialReturn={params.departureTo ?? null}
                    initialTripType={tripType}
                  />
                  <label className="grid gap-1 text-sm font-bold">
                    شرکت حمل‌ونقل
                    <input aria-label="شرکت حمل‌ونقل" className={control} defaultValue={params.provider} name="provider" placeholder="مثلاً رجا یا همسفر" />
                  </label>
                  <label className="grid gap-1 text-sm font-bold">
                    نوع ناوگان یا کوپه
                    <input aria-label="نوع ناوگان یا کوپه" className={control} defaultValue={params.transportClass} name="transportClass" placeholder={selectedType === "train" ? "مثلاً ۴ تخته" : "مثلاً VIP"} />
                  </label>
                  <fieldset className="space-y-2 border-y border-border py-4">
                    <legend className="font-black">ساعت حرکت</legend>
                    {[["", "همه ساعت‌ها"], ["morning", "صبح (۵ تا ۱۲)"], ["afternoon", "بعدازظهر (۱۲ تا ۱۸)"], ["night", "شب (۱۸ تا ۲۴)"]].map(([value, label]) => (
                      <label className="flex items-center gap-2 text-sm" key={value || "all"}>
                        <input defaultChecked={(params.timeSlot ?? "") === value} name="timeSlot" type="radio" value={value} />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {selectedType === "train" ? (
                    <fieldset className="space-y-3 border-b border-border pb-4">
                      <legend className="font-black">امکانات قطار</legend>
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-bold">کوپه</legend>
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs"><input defaultChecked={!params.compartmentType} name="compartmentType" type="radio" value="" /> همه</label>
                          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs"><input defaultChecked={params.compartmentType === "regular"} name="compartmentType" type="radio" value="regular" /> عادی</label>
                          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs"><input defaultChecked={params.compartmentType === "private"} name="compartmentType" type="radio" value="private" /> دربست</label>
                        </div>
                      </fieldset>
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-bold">مسافرین</legend>
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs"><input defaultChecked={!params.passengerCategory || params.passengerCategory === "all"} name="passengerCategory" type="radio" value="" /> همه</label>
                          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs"><input defaultChecked={params.passengerCategory === "women"} name="passengerCategory" type="radio" value="women" /> ویژه خواهران</label>
                          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs"><input defaultChecked={params.passengerCategory === "men"} name="passengerCategory" type="radio" value="men" /> ویژه برادران</label>
                        </div>
                      </fieldset>
                      <label className="flex items-center gap-2 text-sm font-bold"><input defaultChecked={params.carTransport === "true"} name="carTransport" type="checkbox" value="true" /> حمل خودرو می‌خواهم</label>
                    </fieldset>
                  ) : null}
<label className="flex items-center gap-2 text-sm font-bold"><input defaultChecked={params.featured === "true"} name="featured" type="checkbox" value="true" /> فقط پرفروش</label>
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input defaultChecked={params.availableOnly === "true"} name="availableOnly" type="checkbox" value="true" />
                    فقط ظرفیت موجود
                  </label>
                  <button className="min-h-11 w-full rounded-xl bg-accent-strong px-4 text-sm font-black text-white transition hover:bg-brand">
                    اعمال فیلترها
                  </button>
                </form>
                  </div>
                </ResponsiveFilterPanel>
              </aside> : null}
              <div>
                {shouldShowTransportResults ? (
                  <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-brand">
                      {params.origin && params.destination ? `${transportLabel} ${params.origin} به ${params.destination}` : `${transportLabel}های موجود`}
                    </h2>
                    <p className="mt-1 text-sm text-muted">{transportTickets.length.toLocaleString("fa-IR")} گزینه پیدا شد</p>
                  </div>
                  <form action="/services/">
                    <input name="type" type="hidden" value={selectedType} />
                    {Object.entries(params).filter(([key, value]) => key !== "sort" && value).map(([key, value]) => (
                      <input key={key} name={key} type="hidden" value={value} />
                    ))}
                    <SiteSelect ariaLabel="مرتب‌سازی نتایج" className="min-w-44" defaultValue={params.sort || "recommended"} id="service-results-sort" name="sort" options={[{ label: "پیشنهادی", value: "recommended" }, { label: "زودترین حرکت", value: "departure" }, { label: "کمترین قیمت", value: "price-asc" }, { label: "بیشترین قیمت", value: "price-desc" }]} />
                    <button className="mt-2 rounded-lg border border-border px-4 py-2 text-sm" type="submit">اعمال ترتیب</button>
                  </form>
                </div>
                <TransportDateStrip pathname="/services/" selectedDate={params.departureFrom} searchParams={Object.fromEntries(Object.entries(params).filter(([, value]) => typeof value === "string"))} />
                <TicketSelectionProvider kind={selectedType} roundTrip={tripType === "round_trip"}>
                  <div className="mt-5 space-y-4">
                    {transportTickets.length ? transportTickets.map(({ service, direction, useReturnLeg }) => (
                    <TransportResultCard
                      arrivalTime={service.arrivalTime}
                      availableSeats={service.availableSeats}
                      baggageAllowance={service.baggageAllowance}
                      basePrice={service.basePrice}
                      carTransport={service.carTransport}
                      compartmentType={service.compartmentType}
                      currency={service.currency}
                      departureDate={service.departureDate}
                      returnDate={service.returnDate}
                      departureTime={service.departureTime}
                      returnTime={service.returnTime}
                      returnArrivalTime={service.returnArrivalTime}
                      destinationName={service.destinationName}
                      destinationTerminal={service.destinationTerminal}
                      id={service.id}
                      direction={direction}
                      useReturnLeg={useReturnLeg}
                      isFeatured={service.isFeatured}
                      key={`${service.id}-${direction}-${useReturnLeg ? "embedded" : "direct"}`}
                      kind={selectedType}
                      origin={service.origin}
                      originTerminal={service.originTerminal}
                      passengerCategory={service.passengerCategory}
                      providerCompany={service.providerCompany}
                      providerIconImageId={service.providerIconImageId}
                      refundPolicy={service.refundPolicy}
                      slug={service.slug}
                      title={service.title}
                      summary={service.summary}
                      transportClass={service.transportClass}
                    />
                    )) : <AvailabilityNotice departureDate={params.departureFrom} destination={params.destination} iconImageId={emptyStateIconId} label={transportLabel} origin={params.origin} serviceType={selectedType} />}
                  </div>
                  <TransportGuide
                    content={selectedType === "train" ? guideSettings["transportTrainGuide"] : guideSettings["transportBusGuide"]}
                    title={selectedType === "train" ? "راهنمای خرید بلیت قطار" : "راهنمای خرید بلیت اتوبوس"}
                  />
                </TicketSelectionProvider>
                  </>
                ) : (
                  <div className="space-y-6">
                    <CountryDirectory title={`${transportLabel} بر اساس کشور`} label={transportLabel} countries={countryPayload.items} href={`/services/?type=${selectedType}`} offers={transportCatalogPayload.items.map((service) => ({ id: service.id, country: service.country ?? "", imageUrl: service.imageId ? `${PUBLIC_API_BASE_URL}/media/${service.imageId}` : destinationImages.get(service.destinationName?.toLocaleLowerCase("fa-IR") ?? "") ? `${PUBLIC_API_BASE_URL}/media/${destinationImages.get(service.destinationName?.toLocaleLowerCase("fa-IR") ?? "")}` : null, amount: service.basePrice, currency: service.currency }))} />
                    <TransportGuide content={selectedType === "train" ? guideSettings["transportTrainGuide"] : guideSettings["transportBusGuide"]} title={selectedType === "train" ? "راهنمای قطار" : "راهنمای اتوبوس"} />
                    {faqPayload.items.length ? (
                      <section className="rounded-3xl border border-brand/15 bg-white p-5 shadow-sm sm:p-6">
                        <div><p className="text-xs font-black text-accent-strong">{"\u0631\u0627\u0647\u0646\u0645\u0627\u06cc \u0631\u0632\u0631\u0648"}</p><h2 className="mt-1 text-xl font-black text-brand">{selectedType === "train" ? "\u0633\u0648\u0627\u0644\u0627\u062a \u0645\u062a\u062f\u0627\u0648\u0644 \u0642\u0637\u0627\u0631" : "\u0633\u0648\u0627\u0644\u0627\u062a \u0645\u062a\u062f\u0627\u0648\u0644 \u0627\u062a\u0648\u0628\u0648\u0633"}</h2></div>
                        <div className="mt-4 divide-y divide-border">
                          {faqPayload.items.map((faq, index) => (
                            <details className="group py-3" key={faq.id} open={index === 0}>
                              <summary className="cursor-pointer list-none font-black text-brand"><span className="ml-2 inline-grid size-6 place-items-center rounded-full bg-accent text-brand">+</span>{faq.question}</summary>
                              <p className="mr-8 mt-3 text-sm leading-7 text-muted">{faq.answer}</p>
                            </details>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : isVisa && !params.country?.trim() && params.showResults !== "1" ? (
            <div className="space-y-6"><CountryDirectory title="ویزا بر اساس کشور" label="ویزا" countries={countryPayload.items} href="/services/?type=visa" offers={payload.items.map((service) => ({ id: service.id, country: service.country ?? "", imageUrl: service.imageId ? `${PUBLIC_API_BASE_URL}/media/${service.imageId}` : null, amount: service.basePrice, currency: service.currency }))} /><TransportGuide content={guideSettings["visaGuide"]} title="راهنمای ویزا" /></div>
          ) : (
            <div className={catalogStyles.layout}>
              <aside className={catalogStyles.sidebar}><h2>فیلتر {isVisa ? "ویزا" : "خدمات"}</h2><form action="/services/">
                <input name="type" type="hidden" value={selectedType} />{params.visaType ? <input name="visaType" type="hidden" value={params.visaType} /> : null}<input name="showResults" type="hidden" value="1" />
                <CountryCityFields id="service" countries={countryPayload.items} country={params.country} city={params.destination} cities={destinationPayload.items.map((item) => ({ title: item.title, value: item.title, country: item.country }))} />
                <label>حداقل قیمت<input className={control} type="number" min={0} name="minPrice" defaultValue={params.minPrice} /></label>
                <label>حداکثر قیمت<input className={control} type="number" min={0} name="maxPrice" defaultValue={params.maxPrice} /></label>
                <div className="grid gap-2 text-sm font-bold"><span>مرتب‌سازی</span><SiteSelect id="visa-sort" ariaLabel="مرتب‌سازی خدمات" name="sort" defaultValue={params.sort || "recommended"} options={[{ label: "پیشنهادی", value: "recommended" }, { label: "ارزان‌ترین", value: "price-asc" }, { label: "گران‌ترین", value: "price-desc" }]} /></div>
                <button type="submit">اعمال فیلترها</button><Link className="text-center text-xs" href={`/services/?type=${selectedType}&showResults=1`}>پاک کردن فیلترها</Link>
              </form></aside>
              <div className={catalogStyles.content}><h2 className="mb-5 text-2xl font-black text-brand">{isVisa ? "ویزاهای" : "خدمات"} {params.country || "همه کشورها"}</h2>
            {payload.items.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {payload.items.map((service) => (
                <Card as="article" className={`${catalogStyles.catalogCard} overflow-hidden p-0`} key={service.id}>
                  <Link className="group block" href={`/services/${service.slug}/`}>
                    {service.imageId || service.isFeatured ? (
                    <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">{service.isFeatured ? <span className="absolute right-3 top-3 z-10 rounded-full bg-accent-strong px-3 py-1 text-xs font-black text-white">پرفروش</span> : null}
                      {service.imageId ? <Image alt={service.title} className="object-cover transition duration-500 group-hover:scale-105" fill sizes="(max-width: 640px) 100vw, 33vw" src={`${PUBLIC_API_BASE_URL}/media/${service.imageId}`} /> : null}
                    </div>
                    ) : null}
                    <div className="p-4">
                      <p className="inline-flex items-center gap-2 text-xs font-bold text-brand"><CountryFlag country={service.country ?? ""} imageId={service.country ? countryFlagImageIds.get(normalizeCountryName(service.country)) ?? null : null} />{serviceLabels[service.serviceType] ?? service.serviceType}{service.country ? ` · ${service.country}` : ""}</p>
                      <h2 className="mt-2 text-xl font-black text-brand">{service.title}</h2>
                      <p className="mt-3 line-clamp-2 text-sm leading-7 text-muted">{service.summary}</p>
                      <p className="mt-4 font-black text-brand">{service.basePrice ? formatCurrency(service.basePrice, service.currency) : "استعلام قیمت"}</p>
                    </div>
                  </Link>
                  <div className="border-t border-border px-5 pb-5"><RefundPolicyButton policy={service.refundPolicy} /></div>
                </Card>
              ))}
            </div>
            ) : <EmptyState description="پس از انتشار خدمت در پنل مدیریت، اینجا نمایش داده می‌شود." title="خدمتی با این مشخصات منتشر نشده است" />}
              </div>
            </div>
          )}

        </Container>
      </section>
    </>
  );
}
