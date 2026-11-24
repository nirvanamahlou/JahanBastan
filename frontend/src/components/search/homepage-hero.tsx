"use client";

import Image from "next/image";

import {
  type TransportSearchOptions,
  TravelSearch,
} from "@/components/search/travel-search";
import { useHomepageSearchService } from "@/components/search/homepage-search-guide";
import { Container } from "@/components/ui/container";
import styles from "./homepage-hero.module.css";

type Option = { label: string; value: string };

type HomepageHeroProps = {
  hotelCountries: Option[];
  visaCountries: Option[];
  destinations: Option[];
  departures: Option[];
  transportOptions: TransportSearchOptions;
  tourTransportOptions: TransportSearchOptions;
};

export function HomepageHero({
  hotelCountries,
  visaCountries,
  destinations,
  departures,
  transportOptions,
  tourTransportOptions,
}: HomepageHeroProps) {
  const { serviceType, setServiceType } = useHomepageSearchService();

  return (
    <section data-homepage-hero className={styles.hero} aria-label="جستجوی خدمات سفر">
      <Container className={styles.layout}>
        {serviceType === "tour" && (
          <div className={styles.tourBanner}>
            <Image src="/images/hero/tour-mediterranean-panorama.webp" alt="" fill unoptimized loading="eager" />
          </div>
        )}
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
