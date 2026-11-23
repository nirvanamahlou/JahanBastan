type HomepageTour = {
  isHomeRecommended: boolean;
  isFeatured: boolean;
};

/** Select from the complete catalogue in its existing API order. */
export function selectHomepageTours<T extends HomepageTour>(tours: readonly T[]): T[] {
  const recommended = tours.filter(tour => tour.isHomeRecommended).slice(0, 3);
  if (recommended.length === 3) return recommended;

  const remaining = tours.filter(tour => !tour.isHomeRecommended);
  return [
    ...recommended,
    ...remaining.filter(tour => tour.isFeatured),
    ...remaining.filter(tour => !tour.isFeatured),
  ].slice(0, 3);
}

/** Keep every selected offer visible within its country, ahead of ordinary rows. */
export function selectHomepageCountryRows<T extends { country: string; recommended?: boolean }>(rows: readonly T[], country: string): T[] {
  return rows.filter(row => row.country === country)
    .sort((a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)))
    .filter((row, index) => row.recommended || index < 4);
}

/** Zero/unset countries stay off the homepage; positive positions are ordered. */
export function selectHomepageCountries<T extends { displayOrder?: number }>(countries: readonly T[]): T[] {
  return countries.filter(country => (country.displayOrder ?? 0) >= 1)
    .sort((a, b) => a.displayOrder! - b.displayOrder!);
}
