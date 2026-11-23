import { normalizeCountryName } from "./country-name";

type Destination = { title: string; city?: string | null; country: string };

const cityKey = (name: string | null | undefined) => normalizeCountryName(name).toLocaleLowerCase("fa-IR");

export function flightDestinationCountries(destinations: readonly Destination[]) {
  const countries = new Map<string, string>(
    ["تهران", "tehran", "کیش", "kish"].map((city) => [city, "ایران"]),
  );
  for (const destination of destinations) {
    const country = normalizeCountryName(destination.country);
    if (!country) continue;
    for (const name of [destination.city, destination.title]) {
      const key = cityKey(name);
      if (key) countries.set(key, country);
    }
  }
  return (city: string) => countries.get(cityKey(city)) ?? "";
}
