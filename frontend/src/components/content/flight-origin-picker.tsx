"use client";

import { useMemo, useState } from "react";

import { SearchableRouteSelect } from "@/components/search/searchable-route-select";

export type FlightOriginOption = {
  city: string;
  airports: string[];
};

export function FlightOriginPicker({
  initialAirport,
  initialCity,
  options,
}: {
  initialAirport: string;
  initialCity: string;
  options: FlightOriginOption[];
}) {
  const [city, setCity] = useState(initialCity);
  const [airport, setAirport] = useState(initialAirport);
  const airports = useMemo(
    () => options.find((option) => option.city === city)?.airports ?? [],
    [city, options],
  );

  return (
    <>
      <SearchableRouteSelect
        id="flight-origin-city"
        label="شهر مبدأ"
        name="origin"
        onValueChange={(nextCity) => { setCity(nextCity); setAirport(""); }}
        options={options.map((option) => ({ label: option.city, value: option.city, description: `${option.airports.length.toLocaleString("fa-IR")} فرودگاه` }))}
        placeholder="انتخاب شهر مبدأ"
        value={city}
      />
      <SearchableRouteSelect
        id="flight-origin-airport"
        label="فرودگاه مبدأ"
        name="originAirport"
        onValueChange={setAirport}
        options={airports.map((item) => ({ label: item, value: item, description: city }))}
        placeholder={city ? "انتخاب فرودگاه مبدأ" : "ابتدا شهر مبدأ را انتخاب کنید"}
        value={airport}
      />
    </>
  );
}