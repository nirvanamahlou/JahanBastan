"use client";

import { useState } from "react";
import { SiteSelect } from "@/components/ui/site-select";
import { normalizeCountryName } from "@/lib/country-name";

export function CountryCityFields({ countries, cities, country = "", city = "", cityName = "destination", id }: { countries: { name: string }[]; cities: { title: string; value: string; country: string }[]; country?: string; city?: string; cityName?: string; id: string }) {
  const [selectedCountry, setCountry] = useState(normalizeCountryName(country));
  const [selectedCity, setCity] = useState(city);
  const availableCities = cities.filter((item) => !selectedCountry || normalizeCountryName(item.country) === selectedCountry);
  return <>
    <div className="grid min-w-0 gap-2 text-sm font-bold"><span>کشور مقصد</span><SiteSelect ariaLabel="کشور مقصد" id={`${id}-country`} name="country" value={selectedCountry} onValueChange={(value) => { setCountry(value); setCity(""); }} searchable options={[{ label: "همه کشورها", value: "" }, ...countries.map((item) => ({ label: item.name, value: normalizeCountryName(item.name) }))]} /></div>
    <div className="grid min-w-0 gap-2 text-sm font-bold"><span>شهر مقصد</span><SiteSelect ariaLabel="شهر مقصد" id={`${id}-city`} name={cityName} value={selectedCity} onValueChange={setCity} searchable options={[{ label: "همه شهرها", value: "" }, ...availableCities.map((item) => ({ label: item.title, value: item.value }))]} /></div>
  </>;
}
