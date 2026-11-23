"use client";

import { useState } from "react";

export type FlightRangeKind = "price" | "departure" | "arrival" | "duration";

const labels: Record<FlightRangeKind, string> = {
  price: "قیمت",
  departure: "ساعت حرکت",
  arrival: "ساعت رسیدن",
  duration: "مدت سفر",
};

function labelValue(kind: FlightRangeKind, value: number) {
  if (kind === "price") return `${value.toLocaleString("fa-IR")} تومان`;
  const hours = Math.floor(value / 60).toLocaleString("fa-IR");
  const minutes = (value % 60).toLocaleString("fa-IR", { minimumIntegerDigits: 2 });
  return kind === "duration" ? `${hours} س و ${minutes} د` : `${hours}:${minutes}`;
}

export function FlightRangeFilter({ kind, values, initialMin, initialMax }: {
  kind: FlightRangeKind;
  values: number[];
  initialMin: string;
  initialMax: string;
}) {
  const suffix = kind[0].toUpperCase() + kind.slice(1);
  const domain = [...values, ...[initialMin, initialMax].filter(Boolean).map(Number)];
  const minimum = Math.min(...domain);
  const maximum = Math.max(...domain);
  const [low, setLow] = useState(() => initialMin ? Number(initialMin) : minimum);
  const [high, setHigh] = useState(() => initialMax ? Number(initialMax) : maximum);
  const title = labels[kind];
  const isRange = maximum > minimum;
  const position = (value: number) => isRange ? ((value - minimum) / (maximum - minimum)) * 100 : 0;
  const distribution = Array<number>(16).fill(0);
  for (const value of values) {
    distribution[isRange ? Math.min(15, Math.floor(position(value) * 16 / 100)) : 8] += 1;
  }
  const peak = Math.max(1, ...distribution);
  const sliderClass = "price-range-thumb pointer-events-none absolute inset-x-0 top-0 h-7 w-full appearance-none bg-transparent focus-visible:z-20 focus-visible:outline focus-visible:outline-brand";

  return (
    <fieldset className="min-w-0 rounded-2xl border border-brand/15 bg-surface p-3">
      <legend className="px-1 text-sm font-black text-brand">{title}</legend>
      {values.length ? (
        <>
          <div aria-hidden="true" className="grid h-14 grid-cols-[repeat(16,minmax(0,1fr))] items-end gap-[3px] px-1" dir="ltr">
            {distribution.map((count, index) => (
              <span className={`rounded-t-sm ${!isRange || ((index + 1) * 100 / 16 >= position(low) && index * 100 / 16 <= position(high)) ? "bg-[#eb82b2]" : "bg-brand/15"}`} key={index} style={{ height: count ? `${Math.max(12, count * 100 / peak)}%` : 0 }} />
            ))}
          </div>
          {isRange ? (
            <div className="relative -mt-3 h-7" dir="ltr">
              <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-brand/15" />
              <div className="absolute top-3 h-1.5 rounded-full bg-brand" style={{ left: `${position(low)}%`, right: `${100 - position(high)}%` }} />
              <input aria-label={`حداقل ${title}`} aria-valuetext={labelValue(kind, low)} className={`${sliderClass} ${low === maximum ? "z-10" : ""}`} max={maximum} min={minimum} onChange={(event) => setLow(Math.min(Number(event.target.value), high))} step={kind === "price" ? "any" : 1} type="range" value={low} />
              <input aria-label={`حداکثر ${title}`} aria-valuetext={labelValue(kind, high)} className={sliderClass} max={maximum} min={minimum} onChange={(event) => setHigh(Math.max(Number(event.target.value), low))} step={kind === "price" ? "any" : 1} type="range" value={high} />
            </div>
          ) : null}
          <div className="flex flex-wrap justify-between gap-1 text-[11px] font-bold text-muted" dir="ltr">
            <bdi>{labelValue(kind, low)}</bdi>
            {isRange ? <bdi>{labelValue(kind, high)}</bdi> : null}
          </div>
        </>
      ) : <p className="text-xs text-muted">برای این جست‌وجو داده‌ای در دسترس نیست.</p>}
      <input name={`min${suffix}`} type="hidden" value={values.length && isRange ? (low === minimum ? "" : low) : initialMin} />
      <input name={`max${suffix}`} type="hidden" value={values.length && isRange ? (high === maximum ? "" : high) : initialMax} />
    </fieldset>
  );
}
