import Image from "next/image";
import Link from "next/link";
import { ClockIcon, LocationIcon, PlaneIcon, SuitcaseIcon } from "@/components/layout/site-icons";
import { TourResultDates } from "./tour-result-dates";
import styles from "./catalog-layout.module.css";

type CountryDateRange = { native: boolean; departure: string | null; returning: string | null; price: string | null };

export function TourResultRow({ title, slug, summary, imageUrl, destination, date, duration, airline, price, countryDates }: { title: string; slug: string; summary: string | null; imageUrl: string | null; destination: string; date: string; duration: number | null; airline: string; price: string; countryDates?: CountryDateRange }) {
  const href = `/tours/${slug}/`;
  const facts = [
    { label: "تاریخ حرکت", value: date, Icon: ClockIcon },
    { label: "مقصد", value: destination, Icon: LocationIcon },
    { label: "مدت سفر", value: duration ? `${duration.toLocaleString("fa-IR")} روز` : "با استعلام", Icon: SuitcaseIcon },
    { label: "حمل‌ونقل", value: airline, Icon: PlaneIcon },
  ];
  const information = (
    <div className={styles.tourInformation}><h2><Link href={href}>{title}</Link></h2>{summary && <p className="mt-2 line-clamp-2">{summary}</p>}
      <div className={styles.facts}>{facts.map(({ label, value, Icon }) => <div key={label}><Icon className="size-5" /><strong className="line-clamp-2" title={value}>{value}</strong><span>{label}</span></div>)}</div>
      <div className={styles.price}><span className="text-xs font-normal text-muted">شروع قیمت از</span><strong>{price}</strong></div>
    </div>
  );
  const photo = <Link className={styles.photo} href={href} aria-label={title}>{imageUrl ? <Image unoptimized={/^https:\/\//.test(imageUrl)} src={imageUrl} alt="" fill sizes={countryDates ? "(max-width: 600px) 90vw, 200px" : "(max-width: 540px) 100vw, 290px"} /> : null}</Link>;
  if (countryDates) {
    const fallback = countryDates.departure ? { departureDate: countryDates.departure, returnDate: countryDates.returning, price: countryDates.price } : null;
    return <article className={styles.countryResult} data-country-tour-row>
      <div className={styles.countryResultMain}>{information}{photo}</div>
      <TourResultDates href={href} slug={countryDates.native ? slug : null} fallback={fallback} />
    </article>;
  }
  return <article className={styles.row} data-web-tour-row>
    {information}
    <div className={styles.rowMedia}>{photo}<Link className={styles.details} href={href}>مشاهده جزئیات ←</Link></div>
  </article>;
}
