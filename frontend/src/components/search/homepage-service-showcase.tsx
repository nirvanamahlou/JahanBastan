"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useHomepageSearchService } from "./homepage-search-guide";
import { CountryFlag } from "@/components/content/country-flag";
import styles from "./homepage-showcase-rev48.module.css";

export type ShowcaseCard = { id: string; title: string; href: string; imageUrl: string | null; subtitle?: string | null; price?: string | null; country?: string; flagId?: number | null; international?: boolean; stars?: number };
export type ShowcasePanel = { title: string; eyebrow: string; description: string; href: string; action: string; tiles: ShowcaseCard[]; recommendations: ShowcaseCard[] };
function ShowcaseImage({ src, sizes }: { src: string | null; sizes: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <Image src={src} alt="" fill sizes={sizes} onError={() => setFailed(true)} /> : <div className={styles.noImage} />;
}
export function HomepageServiceShowcase({ panels }: { panels: Record<string, ShowcasePanel> }) {
  const { serviceType } = useHomepageSearchService();
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const expanded = expandedService === serviceType;
  const panel = panels[serviceType];
  if (!panel) return null;
  const cards = panel.tiles;
  const isTour = serviceType === "tour";
  return <section id={isTour ? "tour-countries" : undefined} data-service-showcase={serviceType} className={styles.section}><div className={styles.panel}>
    <header className={styles.heading}><span>{panel.eyebrow}</span><h2>{panel.title}</h2>{panel.description ? <p>{panel.description}</p> : null}</header>
    {!isTour ? <div className={styles.controls}><Link href={panel.href}>همه کشورها</Link></div> : null}
    {isTour ? <div id="tour-country-grid" className={styles.countryGrid} data-expanded={expanded}>
      {cards.map(country => <Link key={country.id} href={country.href} className={styles.countryCard}>
        <div className={styles.countryPhoto}><ShowcaseImage src={country.imageUrl} sizes="(max-width:760px) 36vw, 160px" /></div>
        <div className={styles.countryCopy}>
          <h3><CountryFlag country={country.title} imageId={country.flagId} />{country.title}</h3>
          <div className={styles.countryFoot}>
            <p>{country.subtitle}</p>
            <span className={styles.countryArrow} aria-hidden="true">←</span>
          </div>
        </div>
      </Link>)}
    </div> : <div className={styles.tiles}>
      {cards.slice(0, expanded ? undefined : 6).map((card) => <Link href={card.href} key={card.id} className={styles.tile}>
        <ShowcaseImage src={card.imageUrl} sizes="(max-width:760px) 45vw, 30vw" />
        <div className={styles.overlay}><h3>{card.title}</h3>{card.subtitle ? <p>{card.subtitle}</p> : null}<span className={styles.tileAction}>←</span></div>
      </Link>)}
    </div>}
    {!cards.length ? <p className={styles.empty}>در حال حاضر گزینه‌ای برای این بخش منتشر نشده است.</p> : null}
    {(isTour ? cards.length > 2 : cards.length > 6) ? (
      <button
        type="button"
        className={isTour ? styles.countryMore : styles.more}
        aria-controls={isTour ? "tour-country-grid" : undefined}
        aria-expanded={expanded}
        onClick={() => setExpandedService(expanded ? null : serviceType)}
      >
        {expanded ? "نمایش کمتر" : isTour ? "نمایش بیشتر" : "نمایش کشورهای بیشتر"}
      </button>
    ) : null}
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
