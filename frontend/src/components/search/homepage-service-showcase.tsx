"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useHomepageSearchService } from "./homepage-search-guide";
import { CountryFlag } from "@/components/content/country-flag";
import { BusIcon, PlaneIcon, TrainIcon } from "@/components/layout/site-icons";
import transportStyles from "./homepage-transport-cards.module.css";
import styles from "./homepage-showcase-rev48.module.css";

export type ShowcaseCard = {
  id: string;
  title: string;
  href: string;
  imageUrl: string | null;
  subtitle?: string | null;
  price?: string | null;
  country?: string;
  flagId?: number | null;
  international?: boolean;
  stars?: number;
  transport?: { carrier: string | null; logoUrl: string | null; travelClass: string | null; hours: string | null };
};
export type ShowcasePanel = { title: string; eyebrow: string; description: string; href: string; action: string; tiles: ShowcaseCard[]; recommendations: ShowcaseCard[] };
function ShowcaseImage({ src, sizes }: { src: string | null; sizes: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <Image src={src} alt="" fill sizes={sizes} onError={() => setFailed(true)} /> : <div className={styles.noImage} />;
}
function CountryCard({ country }: { country: ShowcaseCard }) {
  return (
    <Link href={country.href} className={styles.countryCard}>
      <div className={styles.countryPhoto}><ShowcaseImage src={country.imageUrl} sizes="(max-width:760px) 36vw, 160px" /></div>
      <div className={styles.countryCopy}>
        <h3><CountryFlag country={country.title} imageId={country.flagId} />{country.title}</h3>
        <div className={styles.countryFoot}>
          <p>{country.subtitle}</p>
          <span className={styles.countryArrow} aria-hidden="true">←</span>
        </div>
      </div>
    </Link>
  );
}

function HotelCountryGrid({ cards }: { cards: ShowcaseCard[] }) {
  return <div className={styles.hotelGrid} role="region" aria-label="کشورهای هتل">
    {cards.map(card => <Link href={card.href} key={card.id} className={styles.hotelTile}>
      <ShowcaseImage src={card.imageUrl} sizes="(max-width:600px) 100vw, 48vw" />
      <h3><CountryFlag country={card.title} imageId={card.flagId} />{card.title}</h3>
      <span className={styles.hotelCount}>{card.subtitle}</span>
    </Link>)}
  </div>;
}

function PopularHotels({ cards, title }: { cards: ShowcaseCard[]; title: string }) {
  return <section className={styles.popular}>
    <h2>{title}</h2>
    {cards.length ? <div className={styles.popularGrid}>
      {cards.map(card => <Link className={styles.popularCard} href={card.href} key={card.id}>
        <div className={styles.popularPhoto}><ShowcaseImage src={card.imageUrl} sizes="(max-width:600px) 90vw, 30vw" /></div>
        <div className={styles.popularBody}>
          {card.stars ? <span className={styles.stars} aria-label={`${card.stars} ستاره`}>{"★".repeat(Math.min(5, card.stars))}</span> : null}
          <h3>{card.title}</h3><p>{card.subtitle}</p>
        </div>
      </Link>)}
    </div> : <p className={styles.empty}>در حال حاضر هتلی برای نمایش موجود نیست.</p>}
  </section>;
}

const transportKinds = {
  flight: { title: "پروازهای موجود", label: "پرواز", icon: PlaneIcon },
  train: { title: "قطارهای موجود", label: "قطار", icon: TrainIcon },
  bus: { title: "سرویس‌های اتوبوس", label: "اتوبوس", icon: BusIcon },
};

function TransportShowcase({ kind, panel }: { kind: keyof typeof transportKinds; panel: ShowcasePanel }) {
  const { title, label, icon: Icon } = transportKinds[kind];
  const cards = panel.recommendations;

  return (
    <section className={transportStyles.section} data-service-showcase={kind} aria-labelledby="homepage-transport-title">
      <header className={transportStyles.header}>
        <h2 id="homepage-transport-title">{title}</h2>
        <Link href={panel.href}>{panel.action} <span aria-hidden="true">←</span></Link>
      </header>
      {cards.length ? (
        <ul className={transportStyles.grid} aria-label={title}>
          {cards.map((card) => (
            <li key={card.id}>
              <Link className={transportStyles.card} href={card.href}>
                <div className={transportStyles.cardTop}>
                  <span className={transportStyles.carrier}>
                    {card.transport?.logoUrl ? (
                      <Image src={card.transport.logoUrl} alt="" width={24} height={24} />
                    ) : <Icon aria-hidden="true" />}
                    {card.transport?.carrier || label}
                  </span>
                  {card.transport?.travelClass && <span>{card.transport.travelClass}</span>}
                </div>
                <h3>{card.title}</h3>
                {(card.subtitle || card.transport?.hours) && (
                  <p className={transportStyles.schedule}>
                    {card.subtitle && <span>{card.subtitle}</span>}
                    {card.transport?.hours && <span>{card.transport.hours}</span>}
                  </p>
                )}
                <div className={transportStyles.cardBottom}>
                  <span>{card.price || "مشاهده جزئیات"}</span>
                  <span className={transportStyles.arrow} aria-hidden="true">←</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className={transportStyles.empty}>فعلاً بلیتی برای نمایش موجود نیست.</p>}
      {panel.tiles.length > 0 && (
        <details className={transportStyles.countries} key={kind}>
          <summary>مرور بر اساس کشور</summary>
          <ul>
            {panel.tiles.map((country) => <li key={country.id}><Link href={country.href}>{country.title}</Link></li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

export function HomepageServiceShowcase({ panels }: { panels: Record<string, ShowcasePanel> }) {
  const { serviceType } = useHomepageSearchService();
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const expanded = expandedService === serviceType;
  const panel = panels[serviceType];
  if (!panel) return null;
  const cards = panel.tiles;
  if (serviceType === "flight" || serviceType === "train" || serviceType === "bus") {
    return <TransportShowcase kind={serviceType} panel={panel} />;
  }
  const isTour = serviceType === "tour";
  return <section id={isTour ? "tour-countries" : undefined} data-service-showcase={serviceType} className={styles.section}><div className={styles.panel}>
    <header className={styles.heading}><span>{panel.eyebrow}</span><h2>{panel.title}</h2>{panel.description ? <p>{panel.description}</p> : null}</header>
    {!isTour ? <div className={styles.controls}><Link href={panel.href}>همه کشورها</Link></div> : null}
    {isTour ? <div id="tour-country-grid" className={styles.countryGrid}>
      {cards.map(country => <CountryCard key={country.id} country={country} />)}
    </div> : serviceType === "hotel" ? <HotelCountryGrid cards={cards.slice(0, expanded ? undefined : 5)} /> : <div className={styles.tiles}>
      {cards.slice(0, expanded ? undefined : 6).map((card) => <Link href={card.href} key={card.id} className={styles.tile}>
        <ShowcaseImage src={card.imageUrl} sizes="(max-width:760px) 45vw, 30vw" />
        <div className={styles.overlay}><h3>{card.title}</h3>{card.subtitle ? <p>{card.subtitle}</p> : null}<span className={styles.tileAction}>←</span></div>
      </Link>)}
    </div>}
    {!cards.length ? <p className={styles.empty}>در حال حاضر گزینه‌ای برای این بخش منتشر نشده است.</p> : null}
    {(!isTour && cards.length > (serviceType === "hotel" ? 5 : 6)) ? (
      <button
        type="button"
        className={styles.more}
        aria-expanded={expanded}
        onClick={() => setExpandedService(expanded ? null : serviceType)}
      >
        {expanded ? "نمایش کمتر" : "نمایش کشورهای بیشتر"}
      </button>
    ) : null}
    {serviceType === "hotel" && <>
      <PopularHotels title="هتل‌های محبوب خارجی" cards={panel.recommendations.filter(card => card.international)} />
      <PopularHotels title="هتل‌های محبوب داخلی" cards={panel.recommendations.filter(card => !card.international)} />
    </>}
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
