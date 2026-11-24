import type { ServiceType } from "@/components/search/travel-search";

/** Panorama artwork shipped with the redesigned homepage, also available in admin. */
export const homepageHeroAssets: Record<ServiceType, string> = {
  tour: "/images/design-rev48/slider-tour-bosphorus.webp",
  hotel: "/images/design-rev48/slider-hotel-aegean-resort.webp",
  flight: "/images/design-rev48/slider-flight-coastal-runway.webp",
  train: "/images/design-rev48/slider-train-anatolian-railway.webp",
  bus: "/images/design-rev48/slider-bus-coastal-highway.webp",
  visa: "/images/design-rev48/slider-visa-passport-desk.webp",
};

export const homepageMobileHeroAssets: Record<ServiceType, string> = {
  tour: "/images/design-rev48/mobile-tour-bosphorus.webp",
  hotel: "/images/design-rev48/mobile-hotel-aegean-resort.webp",
  flight: "/images/design-rev48/mobile-flight-coastal-runway.webp",
  train: "/images/design-rev48/mobile-train-anatolian-railway.webp",
  bus: "/images/design-rev48/mobile-bus-coastal-highway.webp",
  visa: "/images/design-rev48/mobile-visa-passport-desk.webp",
};
