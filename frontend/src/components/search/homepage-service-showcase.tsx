"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useHomepageSearchService } from "./homepage-search-guide";
import { selectHomepageCountryRows } from "@/lib/homepage-tours";
import { CountryFlag } from "@/components/content/country-flag";
import styles from "./homepage-showcase-rev48.module.css";

export type ShowcaseCard = { id: string; title: string; href: string; imageUrl: string | null; subtitle?: string | null; price?: string | null; country?: string; flagId?: number | null; international?: boolean; stars?: number };
export type ShowcaseTourRow = { recommended?: boolean; id: string; country: string; title: string; href: string; imageUrl: string | null; date: string | null; durationDays?: number | null; durationLabel?: string | null; airline: string | null; airlineLogo: string | null; price: string | null };
export type ShowcasePanel = { title: string; eyebrow: string; description: string; href: string; action: string; tiles: ShowcaseCard[]; recommendations: ShowcaseCard[]; tourRows?: ShowcaseTourRow[] };
function ShowcaseImage({ src, sizes }: { src: string | null; sizes: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <Image src={src} alt="" fill sizes={sizes} onError={() => setFailed(true)} /> : <div className={styles.noImage} />;
}
export function HomepageServiceShowcase({ panels }: { panels: Record<string, ShowcasePanel> }) {
  const { serviceType } = useHomepageSearchService();
  const [expanded, setExpanded] = useState(false);
  const panel = panels[serviceType];
  if (!panel) return null;
  const cards = panel.tiles;
  return <section data-service-showcase={serviceType} className={styles.section}><div className={styles.panel}>
    <header className={styles.heading}><span>{panel.eyebrow}</span><h2>{panel.title}</h2>{panel.description ? <p>{panel.description}</p> : null}</header>
    <div className={styles.controls}><Link href={panel.href}>همه کشورها</Link></div>
    {serviceType === "tour" && panel.tourRows?.length ? <div className={styles.countryLists}>
      {cards.filter((country, index) => expanded || index < 6 || panel.tourRows?.some(row => row.country === country.title && row.recommended)).map(country => <article key={country.id} className={styles.countryList}>
        <Link href={country.href} className={styles.countryHeader}>
          <CountryFlag country={country.title} imageId={country.flagId} />
          <span><b>{country.title}</b><small>تورهای شهرهای محبوب</small></span><i>←</i>
        </Link>
        <div className={styles.countryRows}>{selectHomepageCountryRows(panel.tourRows!, country.title).map(row => <Link key={row.id} href={row.href} className={styles.countryRow}>
          <span className={styles.cityImage}><ShowcaseImage src={row.imageUrl} sizes="(max-width:760px) 96px, 112px" /></span>
          <strong className={styles.cityTitle}>{row.title}</strong>
          <span className={styles.rowMeta}><small>حرکت</small><b>{row.date || "استعلام تاریخ"}</b></span>
          <span className={styles.rowMeta}><small>مدت اقامت</small><b>{row.durationLabel || (row.durationDays ? row.durationDays > 1 ? `${(row.durationDays - 1).toLocaleString("fa-IR")} شب و ${row.durationDays.toLocaleString("fa-IR")} روز` : "۱ روز" : "استعلام مدت")}</b></span>
          <span className={styles.rowMeta}><small>شرکت / وسیله</small><b>{row.airlineLogo ? <Image src={row.airlineLogo} width={27} height={27} alt="" /> : null}{row.airline || "اطلاعات در جزئیات"}</b></span>
          <span className={styles.rowPrice}>{row.price || "استعلام قیمت"}</span>
          <span className={styles.rowMore}>مشاهده بیشتر ←</span>
        </Link>)}</div>
      </article>)}
    </div> : <div className={styles.tiles}>
      {cards.slice(0, expanded ? undefined : 6).map((card) => <Link href={card.href} key={card.id} className={styles.tile}>
        <ShowcaseImage src={card.imageUrl} sizes="(max-width:760px) 45vw, 30vw" />
        <div className={styles.overlay}><h3>{card.title}</h3>{card.subtitle ? <p>{card.subtitle}</p> : null}<span className={styles.tileAction}>←</span></div>
      </Link>)}
    </div>}
    {!cards.length ? <p className={styles.empty}>در حال حاضر گزینه‌ای برای این بخش منتشر نشده است.</p> : null}
    {cards.length > 6 ? <button type="button" className={styles.more} onClick={() => setExpanded(!expanded)}>{expanded ? "نمایش کمتر" : "نمایش کشور‌های بیشتر"}</button> : null}
  </div></section>;
}

export function HomepageServiceRecommendations({ panels }: { panels: Record<string, ShowcasePanel> }) {
  const { serviceType } = useHomepageSearchService();
  const panel = panels[serviceType];
  if (!panel) return null;
  const titles: Record<string, string> = { tour: "تورهای پیشنهادی", hotel: "هتل‌های پیشنهادی", visa: "ویزاهای پیشنهادی", flight: "پروازهای پیشنهادی", train: "قطارهای پیشنهادی", bus: "سفرهای پیشنهادی اتوبوس" };
  return <section data-service-recommendations={serviceType} aria-labelledby="home-recommendations-title" className={styles.topRecommendations}>
    <div className={styles.recommendationHeading}><h2 id="home-recommendations-title">{titles[serviceType]}</h2><Link href={panel.href}>مشاهده همه ←</Link></div>
    <div className={styles.recommendations} data-web-card-grid="recommendations">{panel.recommendations.slice(0, 3).map((card) => <article key={card.id} className={styles.recommendation}>
      <div className={styles.copy}><h3><Link href={card.href}>{card.title}</Link></h3>{card.stars ? <span className={styles.stars} aria-label={`${card.stars} ستاره`}>{"★".repeat(Math.min(5, card.stars))}</span> : null}<p>{card.subtitle}</p>{card.price ? <strong>{card.price}</strong> : null}<Link className={styles.primary} href={card.href}>{panel.action} ←</Link></div>
      <Link href={card.href} className={styles.thumbnail} aria-label={card.title}><ShowcaseImage src={card.imageUrl} sizes="(max-width: 767px) 38vw, (max-width: 1199px) 45vw, 440px" /></Link>
    </article>)}</div>
    {!panel.recommendations.length ? <p className={styles.empty}>در حال حاضر پیشنهادی برای این بخش موجود نیست.</p> : null}
  </section>;
}
