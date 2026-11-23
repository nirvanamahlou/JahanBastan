"use client";

import { useMemo, useState } from "react";

import { TourCard } from "@/components/content/tour-card";
import { CountryFilters } from "@/components/content/country-filters";
import styles from "./country-showcase.module.css";
import { dedupeCountriesByName, normalizeCountryName } from "@/lib/country-name";

type Country = { id: number; name: string; imageId?: number | null };
type RouteDestination = { id: number; title: string; slug: string; country: string; city?: string | null };
type Tour = {
  id: number;
  slug: string;
  title: string;
  destinations: RouteDestination[];
  departure: string;
  departureDate?: string | null;
  duration: string;
  transport: string;
  price: string;
  summary?: string | null;
  hotel?: string | null;
  imageUrl?: string | null;
  featured?: boolean;
};


export function CountryTourExplorer({
  countries,
  tours,
}: {
  countries: Country[];
  tours: Tour[];
}) {
  const uniqueCountries = useMemo(
    () => dedupeCountriesByName(countries),
    [countries],
  );
  const countriesWithTours = useMemo(
    () => uniqueCountries.filter((country) => tours.some((tour) => tour.destinations.some((destination) => normalizeCountryName(destination.country) === normalizeCountryName(country.name)))),
    [tours, uniqueCountries],
  );
  const visibleCountries = countriesWithTours.length ? countriesWithTours : uniqueCountries;
  const [activeCountry, setActiveCountry] = useState("all");
  const [activeCity, setActiveCity] = useState("all");
  const [limit, setLimit] = useState(9);
  const availableCities = useMemo(
    () => Array.from(new Set(tours.flatMap((tour) => tour.destinations.filter((destination) => normalizeCountryName(destination.country) === normalizeCountryName(activeCountry)).map((destination) => destination.title)))).sort((a, b) => a.localeCompare(b, "fa")),
    [activeCountry, tours],
  );
  const activeTours = tours
    .flatMap((tour) => {
      const destination = tour.destinations.find((item) =>
        (activeCountry === "all" || normalizeCountryName(item.country) === normalizeCountryName(activeCountry))
        && (activeCity === "all" || item.title === activeCity),
      ) ?? (activeCountry === "all" ? { country: "", title: "مقصد در برنامه سفر" } : undefined);
      return destination ? [{ ...tour, country: destination.country, destination: destination.title }] : [];
    });

  return (
    <div className={styles.explorer} dir="rtl" data-country-explorer="tour">
      <CountryFilters countries={visibleCountries} active={activeCountry} label="فیلتر کشور تورها" onChange={(country) => { setActiveCountry(country); setActiveCity("all"); setLimit(9); }} />
      <div className={styles.toolbar}><p>{activeTours.length.toLocaleString("fa-IR")} تور{activeCountry === "all" ? " در همه کشورها" : ` در ${activeCountry}`}</p><a href={activeCountry === "all" ? "/tours/" : `/tours/?country=${encodeURIComponent(activeCountry)}`}>مشاهده همه تورها ←</a></div>
      {activeCountry !== "all" && availableCities.length > 1 ? <div className={styles.subfilters} role="group" aria-label="فیلتر شهر تورها">{[{value:"all",label:"همه شهرها"},...availableCities.map(city=>({value:city,label:city}))].map(city=><button key={city.value} type="button" aria-pressed={activeCity===city.value} onClick={()=>{setActiveCity(city.value);setLimit(9);}}>{city.label}</button>)}</div> : null}
      {activeTours.length ? <div className={styles.grid}>{activeTours.slice(0,limit).map(tour=><TourCard href={`/tours/${tour.slug}/`} key={tour.id} {...tour} />)}</div> : <p className={styles.empty}>هنوز توری برای این انتخاب منتشر نشده است.</p>}
      {activeTours.length > limit ? <button className={styles.more} type="button" onClick={()=>setLimit(current=>current+9)}>نمایش بیشتر تورها</button> : null}
    </div>
  );
}
