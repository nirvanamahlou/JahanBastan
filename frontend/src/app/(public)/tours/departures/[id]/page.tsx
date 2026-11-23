import { apiGet } from "@/lib/api/client";
import { AvinaHotelSelection } from "../hotel-selection";
import { StructuredTourContent } from "@/components/content/structured-tour-content";
import { RichText } from "@/components/content/rich-text";
import tourStyles from "@/components/content/structured-tour-content.module.css";
import { AvinaDeparturePicker } from "../departure-picker";
import { TourProfileFacts } from "@/components/content/tour-profile-facts";
import { ClockIcon, LocationIcon, PlaneIcon, SuitcaseIcon } from "@/components/layout/site-icons";
import { TourProfileHero } from "@/components/content/tour-profile-hero";
import tourStyles from "@/components/content/structured-tour-content.module.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { TourDetailTabs } from "@/components/content/tour-detail-tabs";
import { formatPersianDate } from "@/lib/persian-date";
import { getDepartures, hotelImages } from "../catalog";

export const dynamic = "force-dynamic";
const time = (value: string) => new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(value));

export default async function DepartureProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [departures, settings] = await Promise.all([
    getDepartures(),
    apiGet<{ socialLinks: Record<string, string> }>("/settings").catch(() => ({ socialLinks: {} as Record<string, string> })),
  ]);
  const selected = departures.find(item => item.id === id);
  if (!selected) notFound();
  const related = departures.filter(item => item.kind === selected.kind && item.resourceId === selected.resourceId);
  const groups = new Map<string, typeof related>();
  for (const item of related) {
    const key = item.startsOn + ":" + item.endsOn;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const schedule = [...groups.values()].map(items => ({
    ...items[0],
    rates: items.flatMap(item => item.rates),
  }));
  const matching = related.filter(item => item.startsOn === selected.startsOn &&
    item.endsOn === selected.endsOn &&
    item.outbound.departureAt === selected.outbound.departureAt &&
    item.outbound.serviceNumber === selected.outbound.serviceNumber &&
    item.returning?.departureAt === selected.returning?.departureAt &&
    item.returning?.serviceNumber === selected.returning?.serviceNumber);
  const tour = {
    ...selected,
    hotels: [...new Map(matching.flatMap(item => item.hotels).map(hotel => [hotel.id, hotel])).values()],
    rates: matching.flatMap(item => item.rates),
  };
  const details = tour.details;
  const steps = details?.itinerary?.filter(step => step.title || step.location || step.description);
  const services = [...new Set([
    ...(tour.includedServices ?? []),
    ...(details?.services ?? "").split(/\r?\n/),
  ].map(service => service.trim()).filter(Boolean))];
  const hasDocuments = Boolean(steps?.length || services.length ||
    details?.requiredDocuments || details?.refundRules || details?.installmentTerms);
  const image = tour.hotels.flatMap(hotelImages)[0];
  return <>
    <TourProfileHero title={tour.title} summary={details?.summary || tour.description}
      image={image && <img src={image} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />}
      badges={<p>{tour.outbound.originName} به {tour.outbound.destinationName}</p>}
      actions={<Link href="#tour-dates" className="rounded-xl bg-white px-4 py-3 font-bold text-brand">{formatPersianDate(tour.startsOn)} تا {formatPersianDate(tour.endsOn)}</Link>} />
    <Container className={`relative z-10 -mt-4 space-y-5 pb-14 ${tourStyles.profileContent}`}>
    <TourProfileFacts facts={[
      { label: "مقصد", value: tour.outbound.destinationName, icon: <LocationIcon className="size-5" /> },
      { label: "تاریخ حرکت", value: formatPersianDate(tour.startsOn), icon: <ClockIcon className="size-5" /> },
      { label: "شرکت هواپیمایی", value: tour.outbound.carrierName, icon: <PlaneIcon className="size-5" /> },
      { label: "وضعیت تور", value: tour.previewOnly ? "پیش‌نمایش" : tour.salesStopped ? "فروش متوقف است" : tour.remainingCapacity === null ? "ظرفیت با استعلام" : "ظرفیت باقی‌مانده: " + tour.remainingCapacity.toLocaleString("fa-IR"), icon: <SuitcaseIcon className="size-5" /> },
    ]} />
    <TourDetailTabs sections={["overview","dates",...(tour.hotels.length ? ["hotels" as const] : []),...(hasDocuments ? ["documents" as const] : [])]} />
    {tour.hotels.some(hotel => hotelImages(hotel).length > 0) && <section aria-label="گالری تصاویر تور" data-tour-section="overview" className="tour-tab-grid tour-tab-panel mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tour.hotels.filter(hotel => hotelImages(hotel).length > 0).slice(0,7).map((hotel,index) => <figure key={hotel.id} className={`relative aspect-square overflow-hidden rounded-3xl ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}>
        <img alt={hotel.name} src={hotelImages(hotel)[0]} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-3 pt-8 text-sm text-white">{hotel.name}</figcaption>
      </figure>)}
    </section>}
    <section id="tour-overview" data-tour-section="overview" className={`tour-tab-panel ${tourStyles.overviewCard}`}>
      <header className={tourStyles.overviewHeader}>
        <span aria-hidden="true" className={tourStyles.overviewIcon}>✦</span>
        <div><p>شروع یک تجربه تازه</p><h2>معرفی تور</h2></div>
      </header>
      <RichText className="mt-4 leading-8 text-muted" content={tour.description || details?.description || details?.summary || ""} />
    </section>
    <section id="tour-dates" data-tour-section="dates" className="tour-tab-panel">
      {tour.hotels.length ? <Link href="#tour-booking" className="text-sm font-bold text-brand">انتخاب تاریخ برگزاری</Link> : <AvinaDeparturePicker tours={schedule} selected={tour} />}
      <h2 className="my-3 text-xl font-black">جزئیات پرواز</h2>
      <div className="grid gap-4 md:grid-cols-2">{[tour.outbound,tour.returning].map((leg,i) => leg && <article key={i} className="rounded-3xl border bg-white p-5 shadow-sm">
        <h3 className="font-black">{i ? "پرواز برگشت" : "پرواز رفت"} · {leg.carrierName}</h3>
        <p className="my-2 text-sm">شماره پرواز {leg.serviceNumber}</p>
        <div className="flex justify-between gap-4"><p>{leg.originName}<br/>{formatPersianDate(leg.departureAt)} · {time(leg.departureAt)}</p><p>{leg.destinationName}{leg.arrivalAt && <><br/>{formatPersianDate(leg.arrivalAt)} · {time(leg.arrivalAt)}</>}</p></div>
        <p className="mt-2 text-xs text-muted">ساعت‌ها به وقت تهران</p>
      </article>)}</div>
    </section>
    <section id="tour-booking" data-tour-section="hotels" className="tour-tab-panel space-y-3"><h2 className="text-xl font-black">هتل‌ها و قیمت‌ها</h2>
      <AvinaDeparturePicker tours={schedule} selected={tour} />
      <AvinaHotelSelection key={tour.id} tour={tour} exchangeRates={{ usdToIrt: settings.socialLinks.exchangeRateUsdIrt, eurToIrt: settings.socialLinks.exchangeRateEurIrt }} />
    </section>
    {hasDocuments && <section id="tour-documents" data-tour-section="documents" className="tour-tab-panel space-y-5">
      <StructuredTourContent showDepartures={false} showHotelPackages={false} item={{
        requiredDocuments: details?.requiredDocuments ?? null,
        refundPolicy: details?.refundRules ?? null,
        installmentTerms: details?.installmentTerms ?? null,
        tourNotes: null,
        travelLegs: [],
        itineraryDays: [],
        departures: [],
        hotelPackages: [],
      }} />
      {steps?.length ? <section className={tourStyles.serviceCard}>
        <header className={tourStyles.serviceHeader}><h2>برنامهٔ سفر</h2></header>
        <div className={tourStyles.itineraryList}>
          {steps.map((step, index) => <details key={index} className={tourStyles.itineraryDay} open={index === 0}>
            <summary>
              <span className={tourStyles.dayBadge}>مرحلهٔ {(index + 1).toLocaleString("fa-IR")}</span>
              <span className={tourStyles.dayTitle}>{[step.title, step.location].filter(Boolean).join(" · ")}</span>
              <span aria-hidden="true" className={tourStyles.dayArrow}>⌄</span>
            </summary>
            <div className={tourStyles.itineraryDescription}>
              <p>{[step.startTime, step.stayDays ? step.stayDays.toLocaleString("fa-IR") + " روز" : null].filter(Boolean).join(" · ")}</p>
              {step.description && <RichText content={step.description} />}
            </div>
          </details>)}
        </div>
      </section> : null}
      {services.length > 0 && <section className={tourStyles.serviceCard}>
        <header className={tourStyles.serviceHeader}>
          <span aria-hidden="true" className={tourStyles.serviceIcon}>✓</span>
          <div><p>همراه این پکیج</p><h2>خدمات داخل برنامه</h2></div>
        </header>
        <ul className={tourStyles.serviceList}>{services.map(service => <li key={service}><span aria-hidden="true">✓</span><span>{service}</span></li>)}</ul>
      </section>}
    </section>}
  </Container></>;
}
