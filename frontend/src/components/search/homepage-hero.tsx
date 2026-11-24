"use client";

import Image from "next/image";

import {
  type ServiceType,
  type TransportSearchOptions,
  TravelSearch,
} from "@/components/search/travel-search";
import { useHomepageSearchService } from "@/components/search/homepage-search-guide";
import { Container } from "@/components/ui/container";
import styles from "./homepage-hero.module.css";

const serviceBanners: Record<ServiceType, string> = {
  tour: "/images/hero/tour-mediterranean-panorama.webp",
  hotel: "/images/hero/hotel-line-panorama.webp",
  flight: "/images/hero/flight-line-panorama.webp",
  bus: "/images/hero/bus-line-panorama.webp",
  train: "/images/hero/train-line-panorama.webp",
  visa: "/images/hero/visa-line-panorama.webp",
};

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
        <div className={styles.serviceBanner}>
          <Image src={serviceBanners[serviceType]} alt="" fill unoptimized loading="eager" />
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
