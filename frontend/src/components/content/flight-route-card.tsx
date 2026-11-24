"use client";

import Image from "next/image";
import { useState } from "react";
import { PlaneTakeoffIcon, SuitcaseIcon } from "@/components/layout/site-icons";
import styles from "./flight-route-card.module.css";

type Endpoint = { city: string; code?: string | null; airport?: string | null; time: string; dateTime?: string; date?: string };
type Props = { label: string; date?: string; carrier: string; logo?: string; flightNumber?: string | null; cabin?: string | null; duration?: string; baggage?: string | null; origin: Endpoint; destination: Endpoint };

export function FlightRouteCard({ label, date, carrier, logo, flightNumber, cabin, duration, baggage, origin, destination }: Props) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  return (
    <section className={styles.card} aria-label={label} dir="rtl">
      <header className={styles.header}>
        <div className={styles.airline}>
          <span className={styles.logo}>
            {logo && failedLogo !== logo ? <Image src={logo} alt="" width={44} height={44} unoptimized onError={() => setFailedLogo(logo)} /> : <PlaneTakeoffIcon className="size-6" aria-hidden />}
          </span>
          <div className={styles.airlineText}><strong>{carrier || "شرکت هواپیمایی"}</strong><span>{flightNumber ? <>پرواز <bdi>{flightNumber}</bdi></> : null}{flightNumber && cabin ? " · " : null}{cabin}</span></div>
        </div>
        <div className={styles.date}><span className={styles.badge}>{label}</span>{date ? <time dateTime={origin.dateTime}>{date}</time> : null}</div>
      </header>
      <div className={styles.route}>
        <div className={styles.endpoint}>
          <span className={styles.caption}>حرکت</span>
          <time className={styles.time} dateTime={origin.dateTime} dir="ltr">{origin.time}</time>
          <div className={styles.city}>{origin.city}{origin.code ? <bdi className={styles.code}>{origin.code}</bdi> : null}</div>
          {origin.airport ? <span className={styles.airport}>{origin.airport}</span> : null}
        </div>
        <div className={styles.connection}>
          <span>{duration}</span>
          <div className={styles.track} aria-hidden><i /><span /><PlaneTakeoffIcon className="size-5 shrink-0 -scale-x-100" /><span /><i /></div>
        </div>
        <div className={`${styles.endpoint} ${styles.arrival}`}>
          <span className={styles.caption}>رسیدن</span>
          <time className={styles.time} dateTime={destination.dateTime} dir="ltr">{destination.time}</time>
          <div className={styles.city}>{destination.city}{destination.code ? <bdi className={styles.code}>{destination.code}</bdi> : null}</div>
          {destination.airport ? <span className={styles.airport}>{destination.airport}</span> : null}
          {destination.date ? <span className={styles.airport}>{destination.date}</span> : null}
        </div>
      </div>
      {baggage ? <footer className={styles.footer}><SuitcaseIcon className="size-4 shrink-0" aria-hidden /><span>بار مجاز</span><strong>{baggage}</strong></footer> : null}
    </section>
  );
}
