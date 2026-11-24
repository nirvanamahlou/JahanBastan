import type { ServiceType } from "@/components/search/travel-search";

/** Panorama artwork shipped with the redesigned homepage, also available in admin. */
export const homepageHeroAssets: Record<ServiceType, string> = {
  tour: "/images/design-rev48/slider-tour-bosphorus.webp",
  hotel: "/images/design-rev48/slider-hotel-aegean-resort.webp",
  flight: "/images/service-banners/flight-panorama.webp",
  train: "/images/service-banners/train.webp",
  bus: "/images/design-rev48/slider-bus-coastal-highway.webp",
  visa: "/images/service-banners/visa.webp",
};

export const homepageMobileHeroAssets: Record<ServiceType, string> = {
  tour: "/images/design-rev48/mobile-tour-bosphorus.webp",
  hotel: "/images/design-rev48/mobile-hotel-aegean-resort.webp",
  flight: "/images/service-banners/flight-panorama.webp",
  train: "/images/service-banners/train.webp",
  bus: "/images/design-rev48/mobile-bus-coastal-highway.webp",
  visa: "/images/service-banners/visa.webp",
};
