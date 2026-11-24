import Image from "next/image";
import Link from "next/link";
import { CalendarIcon, ClockIcon, LocationIcon } from "@/components/layout/site-icons";
import { TravelSearchIcon } from "@/components/search/travel-search-icon";
import { TourResultDates } from "./tour-result-dates";
import styles from "./catalog-layout.module.css";

type TourDateRange = { native: boolean; departure: string | null; returning: string | null; price: string | null };

export function TourResultRow({ title, slug, summary, imageUrl, destination, date, duration, airline, price, dateRanges, countryLayout = false }: { title: string; slug: string; summary: string | null; imageUrl: string | null; destination: string; date: string; duration: number | null; airline: string; price: string; dateRanges?: TourDateRange; countryLayout?: boolean }) {
  const href = `/tours/${slug}/`;
  const facts = [
    { label: "تاریخ حرکت", value: date, Icon: CalendarIcon },
    { label: "مقصد", value: destination, Icon: LocationIcon },
    { label: "مدت سفر", value: duration ? `${duration.toLocaleString("fa-IR")} روز` : "با استعلام", Icon: ClockIcon },
    { label: "ایرلاین", value: airline, Icon: () => <TravelSearchIcon icon="flight" strokeWidth={2} /> },
  ];
  const information = (
    <div className={styles.tourInformation}><h2>{dateRanges ? title : <Link href={href}>{title}</Link>}</h2>{summary && <p className="mt-2 line-clamp-2">{summary}</p>}
      <div className={styles.facts}>{facts.map(({ label, value, Icon }) => <div key={label}><Icon /><strong className="line-clamp-2" title={value}>{value}</strong><span>{label}</span></div>)}</div>
      <div className={styles.price}><span className="text-xs font-normal text-muted">شروع قیمت از</span><strong>{price}</strong></div>
    </div>
  );
  const image = imageUrl ? <Image unoptimized={/^https:\/\//.test(imageUrl)} src={imageUrl} alt="" fill sizes={dateRanges ? "(max-width: 600px) 95vw, 300px" : "(max-width: 540px) 100vw, 290px"} /> : null;
  const photo = dateRanges
    ? <div className={styles.photo}>{image}</div>
    : <Link className={styles.photo} href={href} aria-label={title}>{image}</Link>;
  const fallback = dateRanges?.departure ? { departureDate: dateRanges.departure, returnDate: dateRanges.returning, price: dateRanges.price } : null;
  if (dateRanges) {
    const summaryContent = <div className={styles.countryResultMain}>{information}{photo}</div>;
    return <article className={`${styles.tourCard} ${styles.countryResult}`} data-tour-result data-country-tour-row={countryLayout ? true : undefined}>
      <TourResultDates href={href} slug={dateRanges.native ? slug : null} fallback={fallback} summaryContent={summaryContent} />
    </article>;
  }
  return <article className={styles.row} data-web-tour-row>
    {information}
    <div className={styles.rowMedia}>{photo}<Link className={styles.details} href={href}>مشاهده جزئیات ←</Link></div>
  </article>;
}
