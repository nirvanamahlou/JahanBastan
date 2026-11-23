"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/currency";

export function FlightAirlineFilter({ options, selected, provider, sameAirline, showSameAirline }: {
  options: { name: string; minPrice: number | null }[];
  selected: string[];
  provider: string;
  sameAirline: boolean;
  showSameAirline: boolean;
}) {
  const [search, setSearch] = useState("");
  const matching = (name: string) => name.toLocaleLowerCase("fa-IR").includes(search.trim().toLocaleLowerCase("fa-IR"));
  return (
    <fieldset className="min-w-0 space-y-2 rounded-2xl border border-brand/15 bg-surface p-3">
      <legend className="px-1 text-sm font-black text-brand">شرکت‌های هواپیمایی</legend>
      {showSameAirline ? <label className="flex items-center gap-2 text-xs"><input className="size-4 accent-brand" defaultChecked={sameAirline} name="sameAirline" type="checkbox" value="1" /> فقط یک ایرلاین در رفت و برگشت</label> : null}
      {provider ? <input name="provider" type="hidden" value={provider} /> : null}
      <input aria-label="جست‌وجوی ایرلاین در فیلترها" className="min-h-10 w-full rounded-xl border border-brand/20 px-3 text-sm" onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی نام ایرلاین" type="search" value={search} />
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {options.map(({ name, minPrice }) => (
          <label className="items-center gap-2 rounded-lg bg-brand/5 px-2 py-2 text-xs has-checked:bg-brand-soft" key={name} style={{ display: matching(name) ? "flex" : "none" }}>
            <input className="size-4 shrink-0 accent-brand" defaultChecked={selected.includes(name)} name="airline" type="checkbox" value={name} />
            <span className="min-w-0 flex-1">{name}</span>
            {minPrice !== null ? <small className="shrink-0 text-muted">از {formatCurrency(minPrice, "IRT")}</small> : null}
          </label>
        ))}
        {!options.some(({ name }) => matching(name)) ? <p className="text-xs text-muted">ایرلاینی پیدا نشد.</p> : null}
      </div>
    </fieldset>
  );
}
