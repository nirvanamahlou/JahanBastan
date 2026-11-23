import type { ManagedTour } from "@/types/editorial";

function withoutId<T extends object>(value: T): Omit<T, "id"> {
  const rest = { ...value } as T & { id?: number };
  delete rest.id;
  return rest;
}

/** Shared hotels/media remain references; tour-owned rows receive fresh identities. */
export function copyTourForCreate(source: ManagedTour, existingSlugs: string[]): ManagedTour {
  const copy = structuredClone(source);
  const base = `${source.slug.slice(0, 150)}-copy`;
  let slug = base;
  for (let number = 2; existingSlugs.includes(slug); number += 1) slug = `${base}-${number}`;
  return {
    ...copy,
    id: 0,
    externalCrmId: "",
    slug,
    title: `${source.title.slice(0, 170)} (کپی)`,
    status: "draft",
    publishedAt: null,
    departures: copy.departures.map((departure) => ({
      ...withoutId(departure),
      externalCode: null,
      priceSetCode: null,
      hotelPrices: departure.hotelPrices.map((price) => ({
        ...withoutId(price),
        externalPriceCode: null,
        priceSetCode: null,
      })),
    })),
    travelLegs: copy.travelLegs.map(withoutId),
    itineraryDays: copy.itineraryDays.map(withoutId),
    hotelPackages: copy.hotelPackages.map(withoutId),
    combinedPackages: (copy.combinedPackages ?? []).map((item) => ({
      ...withoutId(item),
      hotels: item.hotels.map(withoutId),
    })),
  };
}
