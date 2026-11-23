import type { ServiceType } from "@/components/search/travel-search";

/** Panorama artwork shipped with the redesigned homepage, also available in admin. */
export const homepageHeroAssets: Record<ServiceType, string> = {
  tour: "/images/design-rev48/slider-tour-istanbul.webp",
  hotel: "/images/design-rev48/slider-hotel.webp",
  flight: "/images/design-rev48/slider-flight.webp",
  train: "/images/design-rev48/slider-train.webp",
  bus: "/images/design-rev48/slider-bus.webp",
  visa: "/images/design-rev48/slider-visa.webp",
};

export const homepageMobileHeroAssets: Record<ServiceType, string> = {
  tour: "/images/design-rev48/mobile-tour-istanbul.webp",
  hotel: "/images/design-rev48/mobile-hotel.webp",
  flight: "/images/design-rev48/mobile-flight.webp",
  train: "/images/design-rev48/mobile-train.webp",
  bus: "/images/design-rev48/mobile-bus.webp",
  visa: "/images/design-rev48/mobile-visa.webp",
};
