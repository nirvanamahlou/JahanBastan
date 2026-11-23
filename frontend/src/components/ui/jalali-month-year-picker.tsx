"use client";

import { useState } from "react";

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

type PickerMode = "month" | "year" | null;

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

function yearPageStart(year: number, minYear: number, maxYear: number) {
  const latestStart = Math.max(minYear, maxYear - 11);
  return Math.min(Math.max(year - 5, minYear), latestStart);
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
  const [mode, setMode] = useState<PickerMode>(null);
  const [pageStart, setPageStart] = useState(() =>
    yearPageStart(year, minYear, maxYear),
  );

  const currentMonthIndex = year * 12 + month - 1;
  const minimumMonthIndex = minYear * 12 + minMonth - 1;
  const maximumMonthIndex = maxYear * 12 + maxMonth - 1;
  const previousMonthDisabled = currentMonthIndex <= minimumMonthIndex;
  const nextMonthDisabled = currentMonthIndex >= maximumMonthIndex;
  const displayedYears = Array.from(
    { length: Math.min(12, maxYear - pageStart + 1) },
    (_, index) => pageStart + index,
  );

  function changeMonth(offset: -1 | 1) {
    const nextMonthIndex = currentMonthIndex + offset;
    if (nextMonthIndex < minimumMonthIndex || nextMonthIndex > maximumMonthIndex) return;
    const nextMonth = month + offset;
    if (nextMonth === 0) onChange({ year: year - 1, month: 12 });
    else if (nextMonth === 13) onChange({ year: year + 1, month: 1 });
    else onChange({ year, month: nextMonth });
    setMode(null);
  }

  function toggleYearGrid() {
    setPageStart(yearPageStart(year, minYear, maxYear));
    setMode((current) => (current === "year" ? null : "year"));
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
          <button
            aria-expanded={mode === "month"}
            className="min-h-10 rounded-xl border border-brand/15 bg-white px-2 text-sm font-black text-brand transition hover:border-brand/40 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
            onClick={() => setMode((current) => (current === "month" ? null : "month"))}
            type="button"
          >
            {JALALI_MONTH_NAMES[month - 1]}
          </button>
          <button
            aria-expanded={mode === "year"}
            className="min-h-10 rounded-xl border border-brand/15 bg-white px-2 text-sm font-black text-brand transition hover:border-brand/40 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
            onClick={toggleYearGrid}
            type="button"
          >
            {persianNumber(year)}
          </button>
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

      {mode === "month" ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="grid" aria-label="ماه‌های سال">
          {JALALI_MONTH_NAMES.map((name, index) => {
            const value = index + 1;
            const selected = value === month;
            const disabled =
              (year === minYear && value < minMonth) ||
              (year === maxYear && value > maxMonth);
            return (
              <button
                aria-selected={selected}
                className={`min-h-10 rounded-xl border px-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-35 ${
                  selected
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-white text-brand hover:border-brand/35 hover:bg-brand-soft"
                }`}
                disabled={disabled}
                key={name}
                onClick={() => {
                  onChange({ year, month: value });
                  setMode(null);
                }}
                role="gridcell"
                type="button"
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : null}

      {mode === "year" ? (
        <div className="mt-2 rounded-2xl border border-border bg-brand-soft/40 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              className="min-h-9 rounded-lg bg-white px-3 text-xs font-bold text-brand disabled:opacity-35"
              disabled={pageStart <= minYear}
              onClick={() => setPageStart((current) => Math.max(minYear, current - 12))}
              type="button"
            >
              سال‌های قبل
            </button>
            <span className="text-xs font-bold text-muted">
              {persianNumber(pageStart)} تا {persianNumber(displayedYears.at(-1) ?? pageStart)}
            </span>
            <button
              className="min-h-9 rounded-lg bg-white px-3 text-xs font-bold text-brand disabled:opacity-35"
              disabled={(displayedYears.at(-1) ?? maxYear) >= maxYear}
              onClick={() =>
                setPageStart((current) => Math.min(Math.max(minYear, maxYear - 11), current + 12))
              }
              type="button"
            >
              سال‌های بعد
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5" role="grid" aria-label="سال‌های شمسی">
            {displayedYears.map((value) => {
              const selected = value === year;
              return (
                <button
                  aria-selected={selected}
                  className={`min-h-10 rounded-xl border text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${
                    selected
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white text-brand hover:border-brand/35 hover:bg-accent"
                  }`}
                  key={value}
                  onClick={() => {
                    onChange({ year: value, month: monthForYear(value) });
                    setMode(null);
                  }}
                  role="gridcell"
                  type="button"
                >
                  {persianNumber(value)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
