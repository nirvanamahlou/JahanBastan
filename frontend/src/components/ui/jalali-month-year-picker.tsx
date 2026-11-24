"use client";

import { useId } from "react";
import { SiteSelect } from "./site-select";

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

type Props = {
  year: number;
  month: number;
  minYear: number;
  maxYear: number;
  minMonth?: number;
  maxMonth?: number;
  onChange: (value: { year: number; month: number }) => void;
};

function persianNumber(value: number) {
  return value.toLocaleString("fa-IR", { useGrouping: false });
}

export function JalaliMonthYearPicker({
  year,
  month,
  minYear,
  maxYear,
  minMonth = 1,
  maxMonth = 12,
  onChange,
}: Props) {
  const id = useId();
  const currentMonthIndex = year * 12 + month - 1;
  const minimumMonthIndex = minYear * 12 + minMonth - 1;
  const maximumMonthIndex = maxYear * 12 + maxMonth - 1;
  const previousMonthDisabled = currentMonthIndex <= minimumMonthIndex;
  const nextMonthDisabled = currentMonthIndex >= maximumMonthIndex;
  const monthOptions = JALALI_MONTH_NAMES.flatMap((name, index) => {
    const value = index + 1;
    const monthIndex = year * 12 + index;
    return monthIndex < minimumMonthIndex || monthIndex > maximumMonthIndex ? [] : [{ label: name, value: String(value) }];
  });
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, index) => {
    const value = minYear + index;
    return { label: persianNumber(value), value: String(value) };
  });

  function changeMonth(offset: -1 | 1) {
    const nextMonthIndex = currentMonthIndex + offset;
    if (nextMonthIndex < minimumMonthIndex || nextMonthIndex > maximumMonthIndex) return;
    const nextMonth = month + offset;
    if (nextMonth === 0) onChange({ year: year - 1, month: 12 });
    else if (nextMonth === 13) onChange({ year: year + 1, month: 1 });
    else onChange({ year, month: nextMonth });
  }

  function monthForYear(nextYear: number) {
    const firstMonth = nextYear === minYear ? minMonth : 1;
    const lastMonth = nextYear === maxYear ? maxMonth : 12;
    return Math.min(lastMonth, Math.max(firstMonth, month));
  }

  return (
    <section
      aria-label="انتخاب ماه و سال"
      className="border-b border-border bg-surface px-3 py-2.5 text-brand"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="ماه قبل"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-xl font-black transition hover:border-brand/35 hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-35"
          disabled={previousMonthDisabled}
          onClick={() => changeMonth(-1)}
          type="button"
        >
          <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          <SiteSelect ariaLabel="ماه" id={`${id}-month`} compactMenu value={String(month)} options={monthOptions}
            className="min-h-10! px-2! text-xs!" onValueChange={(value) => onChange({ year, month: Number(value) })} />
          <SiteSelect ariaLabel="سال" id={`${id}-year`} compactMenu value={String(year)} options={yearOptions}
            className="min-h-10! px-2! text-xs!" onValueChange={(value) => {
              const nextYear = Number(value);
              onChange({ year: nextYear, month: monthForYear(nextYear) });
            }} />
        </div>
        <button
          aria-label="ماه بعد"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-xl font-black transition hover:border-brand/35 hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-35"
          disabled={nextMonthDisabled}
          onClick={() => changeMonth(1)}
          type="button"
        >
          <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
      </div>

    </section>
  );
}
