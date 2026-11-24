"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/layout/site-icons";

type PassengerSelectorProps = {
  className?: string;
  label?: string;
  name?: string;
  required?: boolean;
  tourAgeGroups?: boolean;
};

type PassengerKind = "adults" | "children" | "olderChildren" | "infants";

type PassengerRow = { key: PassengerKind; label: string; hint: string; minimum: number };

const passengerRows: PassengerRow[] = [
  { key: "adults", label: "بزرگسال", hint: "۱۲ سال به بالا", minimum: 1 },
  { key: "children", label: "کودک", hint: "۲ تا ۱۱ سال", minimum: 0 },
  { key: "infants", label: "نوزاد", hint: "تا ۲ سال", minimum: 0 },
];

const tourPassengerRows: PassengerRow[] = [
  passengerRows[0],
  { key: "children", label: "کودک ۲ تا ۶ سال", hint: "۲ سال تمام تا زیر ۶ سال", minimum: 0 },
  { key: "olderChildren", label: "کودک ۶ تا ۱۲ سال", hint: "۶ سال تمام تا زیر ۱۲ سال", minimum: 0 },
  { ...passengerRows[2], hint: "زیر ۲ سال" },
];

export function PassengerSelector({
  className = "",
  label = "مسافران",
  name = "passengerCount",
  required = false,
  tourAgeGroups = false,
}: PassengerSelectorProps) {
  const [counts, setCounts] = useState<Record<PassengerKind, number>>({
    adults: 1,
    children: 0,
    olderChildren: 0,
    infants: 0,
  });
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideInteraction);
    document.addEventListener("touchstart", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideInteraction);
      document.removeEventListener("touchstart", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const childCount = counts.children + (tourAgeGroups ? counts.olderChildren : 0);
  const total = counts.adults + childCount + counts.infants;
  const summary = [
    `${counts.adults.toLocaleString("fa-IR")} بزرگسال`,
    childCount ? `${childCount.toLocaleString("fa-IR")} کودک` : null,
    counts.infants ? `${counts.infants.toLocaleString("fa-IR")} نوزاد` : null,
  ]
    .filter(Boolean)
    .join("، ");

  const update = (key: PassengerKind, delta: number, minimum: number) => {
    setCounts((current) => {
      if (tourAgeGroups && delta > 0 && Object.values(current).reduce((sum, count) => sum + count, 0) >= 20) return current;
      return { ...current, [key]: Math.max(minimum, Math.min(20, current[key] + delta)) };
    });
  };

  return (
    <div className={`relative grid h-full min-w-0 gap-1 ${className}`} data-passenger-selector ref={wrapperRef}>
      <span className="text-[10px] font-bold sm:text-xs">{label}</span>
      <input name={name} required={required} type="hidden" value={total} />
      <input name="adultCount" type="hidden" value={counts.adults} />
      <input name="childCount" type="hidden" value={childCount} />
      <input name="infantCount" type="hidden" value={counts.infants} />
      <div className="relative">
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className="flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-xl border border-brand/25 bg-white/75 px-3 text-xs font-bold text-brand shadow-sm transition hover:border-accent-strong hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent sm:min-h-10 xl:min-h-9"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className="min-w-0 flex-1 truncate">{summary}</span>
          <span aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
            <ChevronDownIcon className="size-4" />
          </span>
        </button>
        {open ? (
          <div className="absolute start-0 top-[calc(100%+0.4rem)] z-50 w-[min(19rem,calc(100vw-2rem))] max-w-none rounded-2xl border border-brand/25 bg-surface p-3 shadow-[0_18px_42px_rgba(1,37,105,0.18)]" role="dialog" aria-label={label}>
          {(tourAgeGroups ? tourPassengerRows : passengerRows).map((row) => (
            <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0" key={row.key}>
              <div>
                <p className="text-sm font-black text-brand">{row.label}</p>
                <p className="mt-0.5 text-[11px] text-muted">{row.hint}</p>
              </div>
              <div className="inline-flex items-center rounded-xl border border-border bg-surface-muted p-1">
                <button
                  aria-label={`کم کردن ${row.label}`}
                  className="grid size-7 place-items-center rounded-lg text-brand transition hover:bg-accent hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={counts[row.key] <= row.minimum}
                  onClick={(event) => {
                    event.preventDefault();
                    update(row.key, -1, row.minimum);
                  }}
                  type="button"
                >
                  −
                </button>
                <output aria-live="polite" className="grid min-w-8 place-items-center text-sm font-black text-brand">
                  {counts[row.key].toLocaleString("fa-IR")}
                </output>
                <button
                  aria-label={`زیاد کردن ${row.label}`}
                  disabled={tourAgeGroups && total >= 20}
                  className="grid size-7 place-items-center rounded-lg text-brand transition hover:bg-accent hover:text-brand"
                  onClick={(event) => {
                    event.preventDefault();
                    update(row.key, 1, row.minimum);
                  }}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <p className="mt-2 text-xs text-muted">مجموع: {total.toLocaleString("fa-IR")} مسافر</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
