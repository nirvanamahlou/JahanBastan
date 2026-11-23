"use client";

import Image from "next/image";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { normalizeCountryName } from "@/lib/country-name";
import styles from "./country-showcase.module.css";

export type ExplorerCountry = { id: number; name: string; imageId?: number | null };
export function CountryFilters({ countries, active, onChange, label }: { countries: ExplorerCountry[]; active: string; onChange: (value: string) => void; label: string }) {
  return <div className={styles.filters} role="group" aria-label={label}>
    <button className={styles.filter} aria-pressed={active === "all"} onClick={() => onChange("all")} type="button"><span aria-hidden="true">◎</span> همه</button>
    {countries.map((country) => {
      const name = normalizeCountryName(country.name);
      return <button className={styles.filter} aria-pressed={active === name} onClick={() => onChange(name)} key={country.id} type="button">{country.imageId ? <Image alt="" className={styles.flag} src={`${PUBLIC_API_BASE_URL}/media/${country.imageId}`} width={28} height={20} /> : null}{name}</button>;
    })}
  </div>;
}
