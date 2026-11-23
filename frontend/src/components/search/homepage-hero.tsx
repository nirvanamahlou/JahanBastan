"use client";

import Image from "next/image";
import { useState } from "react";
import { homepageHeroAssets, homepageMobileHeroAssets } from "@/lib/homepage-hero-assets";

import {
  type ServiceType,
  type TransportSearchOptions,
  serviceTabs,
  TravelSearch,
} from "@/components/search/travel-search";
import { useHomepageSearchService } from "@/components/search/homepage-search-guide";
import { Container } from "@/components/ui/container";
import styles from "./homepage-hero.module.css";

type Option = { label: string; value: string };

const FALLBACK_HERO_IMAGE = "/images/hero/kusadasi-coast-hero.jpg";

const heroFocus: Record<ServiceType, string> = {
  tour: "60% 50%", hotel: "50% 50%", flight: "54% 50%",
  bus: "65% 50%", train: "65% 50%", visa: "52% 50%",
};

type HomepageHeroProps = {
  heroImages: Record<ServiceType, string>;
  hotelCountries: Option[];
  visaCountries: Option[];
  destinations: Option[];
  departures: Option[];
  transportOptions: TransportSearchOptions;
  tourTransportOptions: TransportSearchOptions;
};

export function HomepageHero({
  heroImages,
  hotelCountries,
  visaCountries,
  destinations,
  departures,
  transportOptions,
  tourTransportOptions,
}: HomepageHeroProps) {
  const { serviceType, setServiceType } = useHomepageSearchService();
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const activeIndex = serviceTabs.findIndex(tab => tab.key === serviceType);
  const activeTab = serviceTabs.find((tab) => tab.key === serviceType);
  const activeImage = heroImages[serviceType] || "/images/hero/santorini-app.webp";
  const visibleImage = failedImages.has(activeImage)
    ? FALLBACK_HERO_IMAGE
    : activeImage;

  return (
    <section data-homepage-hero className={styles.hero} aria-label="جستجوی خدمات سفر">
      <Container className={styles.layout}>
        <div className={styles.visual} data-tour-panorama={serviceType === "tour" && visibleImage === homepageHeroAssets.tour ? "" : undefined}>
          <div className={styles.imageFrame}>
            <picture>
              <source media="(max-width: 760px)" srcSet={activeImage === homepageHeroAssets[serviceType] && !failedImages.has(activeImage) ? homepageMobileHeroAssets[serviceType] : visibleImage} />
              <Image key={`${serviceType}-${visibleImage}`} src={visibleImage}
                alt={`تصویر خدمات ${activeTab?.label ?? "سفر"} جهان باستان`} fill loading="eager"
                fetchPriority={serviceType === "tour" ? "high" : "auto"}
                sizes="(max-width: 767px) 100vw, (max-width: 1664px) 96vw, 1440px"
                className={styles.image}
                style={{ objectPosition: activeImage === homepageHeroAssets[serviceType] ? "center" : heroFocus[serviceType] }}
                onError={() => { if (visibleImage === FALLBACK_HERO_IMAGE) return; setFailedImages(current => new Set([...current, activeImage])); }} />
            </picture>
          </div>
          <div className={styles.slideControls} aria-label="مرور خدمات سفر">
            <button type="button" aria-label="خدمت قبلی" onClick={() => setServiceType(serviceTabs[(activeIndex + 5) % 6].key)}>→</button>
            <span aria-live="polite">{(activeIndex + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })} / ۰۶</span>
            <button type="button" aria-label="خدمت بعدی" onClick={() => setServiceType(serviceTabs[(activeIndex + 1) % 6].key)}>←</button>
          </div>
        </div>
        <div className={styles.content}>
          <div id="trip-search" tabIndex={-1} data-home-search="true" className={styles.search}>
            <TravelSearch key={serviceType} hotelCountries={hotelCountries} visaCountries={visaCountries}
              destinations={destinations} departures={departures} transportOptions={transportOptions}
              tourTransportOptions={tourTransportOptions} serviceType={serviceType} onServiceTypeChange={setServiceType} />
          </div>
        </div>
      </Container>
    </section>
  );
}
