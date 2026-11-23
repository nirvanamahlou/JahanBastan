import { normalizeCountryName } from "./country-name";

export function mergeCountryCounts(rows: Array<{ country: string; count: number; imageId: number | null }>) {
  const groups = new Map<string, { country: string; count: number; imageId: number | null }>();
  for (const row of rows) {
    const country = normalizeCountryName(row.country);
    if (!country) continue;
    const previous = groups.get(country);
    groups.set(country, { country, count: (previous?.count ?? 0) + row.count, imageId: previous?.imageId ?? row.imageId });
  }
  return [...groups.values()];
}

export type CountryOffer = {
  id: string | number;
  country: string;
  imageUrl: string | null;
  amount?: string | null;
  currency?: string | null;
};

/** Count each published offer once per country, including multi-country tours. */
export function groupCountryOffers(offers: CountryOffer[]) {
  const groups = new Map<string, CountryOffer[]>();
  for (const offer of offers) {
    const country = normalizeCountryName(offer.country);
    if (!country) continue;
    const group = groups.get(country) ?? [];
    if (!group.some((item) => item.id === offer.id)) group.push(offer);
    groups.set(country, group);
  }
  return [...groups].map(([country, items]) => {
    const priced = items.filter((item) => Number(item.amount) > 0 && Number.isFinite(Number(item.amount)));
    // Amounts in different currencies cannot be compared without an exchange rate.
    const currencies = new Set(priced.map((item) => item.currency));
    const cheapest = currencies.size === 1 ? [...priced].sort((a, b) => Number(a.amount) - Number(b.amount))[0] : undefined;
    return { country, count: items.length, imageUrl: items.find((item) => item.imageUrl)?.imageUrl ?? null, cheapest };
  });
}
