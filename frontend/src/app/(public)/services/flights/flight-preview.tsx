import Link from "next/link";
import flight from "./flight-preview.json";
import styles from "./flight-preview.module.css";

const flightList = "/services/flights/";
const number = new Intl.NumberFormat("fa-IR");
const clock = (instant: string, timeZone: string) =>
  new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(instant));
const date = new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeZone: "Asia/Tehran" }).format(new Date(flight.depart));

export function currentFlightPreview() {
  return Date.now() < Date.parse(flight.depart);
}

export function FlightPreviewLink() {
  if (!currentFlightPreview()) return null;
  return <div className={styles.teaser}>
    <Link href={flightList + "?preview=" + flight.number}>
      <span>پیش‌نمایش پرواز {flight.origin} به {flight.destination}</span>
      <bdi>{flight.number}</bdi><span aria-hidden="true">←</span>
    </Link>
  </div>;
}

export function FlightPreview() {
  const duration = (Date.parse(flight.arrive) - Date.parse(flight.depart)) / 60000;
  return <section aria-labelledby="flight-preview-heading" className={styles.page} dir="rtl">
    <Link className={styles.back} href={flightList}>بازگشت به پروازها</Link>
    <header className={styles.header}>
      <div><p>{date}</p><h1 id="flight-preview-heading">پرواز {flight.origin} به {flight.destination}</h1></div>
      <span className={styles.badge}>فقط نمایش</span>
    </header>
    <article className={styles.ticket} aria-label="مشخصات پرواز">
      <div className={styles.itinerary}>
        <div className={styles.meta}><strong>{flight.carrier}</strong><bdi>{flight.number}</bdi><span>یک‌طرفه · اکونومی</span></div>
        <div className={styles.route}>
          <div><time dateTime={flight.depart}>{clock(flight.depart, "Asia/Tehran")}</time><strong>{flight.origin} <bdi>{flight.originCode}</bdi></strong></div>
          <div className={styles.track}><small>{number.format(duration)} دقیقه</small><span aria-hidden="true">✈</span></div>
          <div><time dateTime={flight.arrive}>{clock(flight.arrive, "Asia/Dubai")}</time><strong>{flight.destination} <bdi>{flight.destinationCode}</bdi></strong></div>
        </div>
        <p>ساعت حرکت و رسیدن به وقت محلی هر شهر است.</p>
        <div className={styles.meta}><span>بار مجاز {number.format(flight.baggage)} کیلوگرم</span><span>ظرفیت لود {number.format(flight.seats)} نفر</span></div>
      </div>
      <aside className={styles.fares} aria-label="نرخ نمونه بلیت">
        <h2>نرخ بلیت</h2>
        <dl>{([["بزرگسال", flight.adult], ["کودک", flight.child], ["نوزاد", flight.infant]] as const).map(([label, rial]) =>
          <div key={label}><dt>{label}</dt><dd>{number.format(rial / 10)} تومان</dd></div>)}</dl>
        <p>رزرو و پرداخت برای این پیش‌نمایش غیرفعال است.</p>
      </aside>
    </article>
  </section>;
}
