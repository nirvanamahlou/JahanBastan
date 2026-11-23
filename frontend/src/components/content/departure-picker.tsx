"use client";

import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";

type Option = {
  id: number;
  departureDate: string | null;
  label: string;
  currency: string;
  priceAmount: string | null;
  nights?: number | null;
};

export function DeparturePicker<T extends Option>({ options, selected, onSelect, available, plain = false }: {
  options: T[];
  plain?: boolean;
  selected?: T | null;
  onSelect: (id: number) => void;
  available: (item: T) => boolean;
}) {
  const groups = new Map<string, T[]>();
  const key = (item: T) => item.departureDate || String(item.id);
  for (const item of options) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return (
    <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3 text-center">
      {Array.from(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
        <fieldset key={date} className={`min-w-0 rounded-2xl border border-border p-2.5 ${plain ? "bg-white" : "bg-surface-muted"}`}>
          <legend className="mx-auto px-2 text-center text-sm font-black text-brand">
            {items[0].departureDate ? formatPersianDate(items[0].departureDate) : items[0].label}
          </legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,5.5rem),1fr))] gap-2">
            {[...items].sort((a,b) => (a.nights ?? 0) - (b.nights ?? 0)).map(item => (
              <button type="button" key={item.id} disabled={!available(item)} aria-pressed={selected?.id === item.id}
                className={`grid min-h-16 content-center gap-1 rounded-xl border border-border bg-white px-2 py-2 text-center text-brand enabled:hover:border-brand focus-visible:outline-2 focus-visible:outline-brand aria-pressed:border-brand disabled:opacity-50 ${plain ? "aria-pressed:ring-1 aria-pressed:ring-brand" : "aria-pressed:bg-brand aria-pressed:text-white"}`}
                onClick={() => onSelect(item.id)}>
                <strong>{item.nights ? item.nights.toLocaleString("fa-IR") + " شب" : item.label}</strong>
                <span className="text-xs">{Number(item.priceAmount) > 0 && item.priceAmount ? "اقامت از " + formatCurrency(item.priceAmount, item.currency) : "استعلام قیمت"}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
