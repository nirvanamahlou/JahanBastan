"use client";

import { useMemo, useState } from "react";

type PriceRangeFilterProps = {
  minValue: number;
  maxValue: number;
  initialMin?: string;
  initialMax?: string;
  omitBounds?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function asNumber(value: string | undefined, fallback: number) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function currency(value: number) {
  return `${value.toLocaleString("fa-IR")} تومان`;
}

export function PriceRangeFilter({ minValue, maxValue, initialMin, initialMax, omitBounds }: PriceRangeFilterProps) {
  const ceiling = Math.max(maxValue, minValue + 1);
  const step = useMemo(() => omitBounds ? "any" : Math.max(1_000, Math.round((ceiling - minValue) / 100)), [ceiling, minValue, omitBounds]);
  const [low, setLow] = useState(() => clamp(asNumber(initialMin, minValue), minValue, ceiling));
  const [high, setHigh] = useState(() => Math.max(clamp(asNumber(initialMax, ceiling), minValue, ceiling), low));
  const lowPosition = ((low - minValue) / (ceiling - minValue)) * 100;
  const highPosition = ((high - minValue) / (ceiling - minValue)) * 100;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-muted">
        <span>از {currency(low)}</span>
        <span>تا {currency(high)}</span>
      </div>
      <div className="relative h-7" dir="rtl">
        <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-brand/15" />
        <div className="absolute top-3 h-1.5 rounded-full bg-accent-strong" style={{ left: 100 - highPosition + "%", right: lowPosition + "%" }} />
        <input aria-label="حداقل قیمت" className="price-range-thumb pointer-events-none absolute inset-x-0 top-0 h-7 w-full appearance-none bg-transparent" max={high} min={minValue} onChange={(event) => setLow(Math.min(Number(event.target.value), high))} step={step} type="range" value={low} />
        <input aria-label="حداکثر قیمت" className="price-range-thumb pointer-events-none absolute inset-x-0 top-0 h-7 w-full appearance-none bg-transparent" max={ceiling} min={low} onChange={(event) => setHigh(Math.max(Number(event.target.value), low))} step={step} type="range" value={high} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>{currency(minValue)}</span>
        <span>{currency(ceiling)}</span>
      </div>
      <input name="minPrice" type="hidden" value={omitBounds && low === minValue ? "" : low} />
      <input name="maxPrice" type="hidden" value={omitBounds && high === ceiling ? "" : high} />
    </div>
  );
}
