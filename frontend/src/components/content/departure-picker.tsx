"use client";

import { formatCurrency } from "@/lib/currency";
import { tourReturnDate } from "@/lib/tour-departure-availability";
import { formatPersianDate } from "@/lib/persian-date";

type Option = {
  id: number;
  departureDate: string | null;
  returnDate?: string | null;
  label: string;
  currency: string;
  priceAmount: string | null;
  nights?: number | null;
};

export function DeparturePicker<T extends Option>({ options, selected, onSelect, available, plain = false, sidebar = false }: {
  options: T[];
  plain?: boolean;
  sidebar?: boolean;
  selected?: T | null;
  onSelect: (id: number) => void;
  available: (item: T) => boolean;
}) {
  if (sidebar) {
    const sorted = [...options].sort((a, b) =>
      (a.departureDate ?? "").localeCompare(b.departureDate ?? "") || (a.nights ?? 0) - (b.nights ?? 0),
    );
    return (
      <div className="mt-2 grid max-h-48 gap-1.5 overflow-y-auto p-0.5 pe-1 [scrollbar-width:thin]">
        {sorted.map(item => {
          const returnDate = item.departureDate ? tourReturnDate(item.departureDate, item.returnDate ?? null, item.nights) : null;
          const nights = item.nights != null ? item.nights.toLocaleString("fa-IR") + " شب" : null;
          const price = Number(item.priceAmount) > 0 && item.priceAmount
            ? "اقامت از " + formatCurrency(item.priceAmount, item.currency)
            : "استعلام قیمت";
          return (
            <button
              aria-pressed={selected?.id === item.id}
              className="grid min-h-10 min-w-0 gap-0.5 rounded-lg border border-border bg-white px-2 py-1.5 text-center text-brand enabled:hover:border-brand focus-visible:outline-2 focus-visible:outline-brand aria-pressed:border-brand aria-pressed:bg-brand-soft disabled:opacity-50"
              disabled={!available(item)}
              key={item.id}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              <span className="text-xs font-bold leading-snug">
                {item.departureDate ? <time dateTime={item.departureDate}>{formatPersianDate(item.departureDate)}</time> : item.label}
                {returnDate && <> تا <time dateTime={returnDate}>{formatPersianDate(returnDate)}</time></>}
              </span>
              <span className="text-[11px] leading-snug">{nights && <>{nights} · </>}{price}</span>
            </button>
          );
        })}
      </div>
    );
  }

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
                className={`grid content-center gap-1 rounded-xl border border-border bg-white px-2 py-2 text-center text-brand enabled:hover:border-brand focus-visible:outline-2 focus-visible:outline-brand aria-pressed:border-brand disabled:opacity-50 min-h-16 ${plain ? "aria-pressed:ring-1 aria-pressed:ring-brand" : "aria-pressed:bg-brand aria-pressed:text-white"}`}
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
