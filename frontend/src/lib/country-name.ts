export type CountryImage = {
  name: string;
  imageId: number | null;
};

type NamedCountry = {
  name: string;
};

export function normalizeCountryName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

export function dedupeCountriesByName<T extends NamedCountry>(countries: T[]) {
  const seen = new Set<string>();

  return countries.filter((country) => {
    const normalizedName = normalizeCountryName(country.name);
    if (!normalizedName || seen.has(normalizedName)) return false;

    seen.add(normalizedName);
    return true;
  });
}

export function createCountryImageMap(countries: CountryImage[]) {
  return new Map(
    countries.map((country) => [
      normalizeCountryName(country.name),
      country.imageId,
    ]),
  );
}

export function findCountryImageId(
  countries: CountryImage[],
  countryName: string | null | undefined,
) {
  return createCountryImageMap(countries).get(normalizeCountryName(countryName)) ?? null;
}
