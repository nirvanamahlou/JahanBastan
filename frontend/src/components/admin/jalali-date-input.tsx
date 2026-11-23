"use client";

import { useEffect, useId, useRef, useState } from "react";

import { JalaliCalendarModal } from "@/components/ui/jalali-calendar-modal";
import {
  JALALI_MONTH_NAMES,
  JalaliMonthYearPicker,
} from "@/components/ui/jalali-month-year-picker";
import { isoToJalaliInput, jalaliInputToIso } from "@/lib/persian-date";

type Props = {
  ariaLabel?: string;
  className?: string;
  max?: string;
  min?: string;
  name?: string;
  onChange?: (isoValue: string | null) => void;
  required?: boolean;
  value: string | null;
  yearSelection?: boolean;
};

const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function parseJalali(value: string) {
  const [year, month] = value.split("/").map(Number);
  return { year, month };
}

function persianNumber(value: number) {
  return value.toLocaleString("fa-IR", { useGrouping: false });
}

function monthLength(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return jalaliInputToIso(`${year}/12/30`) ? 30 : 29;
}

export function JalaliDateInput({
  ariaLabel = "تاریخ شمسی",
  className,
  max,
  min,
  name,
  onChange,
  required,
  value,
  yearSelection = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const [committed, setCommitted] = useState<string | null>(value);
  const [draft, setDraft] = useState(isoToJalaliInput(value));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const initial = parseJalali(isoToJalaliInput(value) || isoToJalaliInput(new Date().toISOString()));
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const effectiveValue = name ? committed : value;

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setCommitted(value);
      setDraft(isoToJalaliInput(value));
      setError("");
      inputRef.current?.setCustomValidity("");
    }, 0);
    const form = rootRef.current?.closest("form");
    const reset = () => {
      setCommitted(value);
      setDraft(isoToJalaliInput(value));
      setError("");
      inputRef.current?.setCustomValidity("");
      setOpen(false);
    };
    form?.addEventListener("reset", reset);
    return () => {
      window.clearTimeout(syncTimer);
      form?.removeEventListener("reset", reset);
    };
  }, [value]);

  function draftError(inputValue: string) {
    const trimmed = inputValue.trim();
    if (!trimmed) return required ? "تاریخ الزامی است." : "";
    const isoValue = jalaliInputToIso(trimmed);
    if (!isoValue) return "تاریخ شمسی معتبر نیست؛ نمونه: ۱۴۰۵/۰۵/۱۲";
    if (min && isoValue < min) return `تاریخ باید از ${isoToJalaliInput(min)} به بعد باشد.`;
    if (max && isoValue > max) return `تاریخ باید تا ${isoToJalaliInput(max)} باشد.`;
    return "";
  }

  function commit(isoValue: string | null) {
    setCommitted(isoValue);
    setDraft(isoToJalaliInput(isoValue));
    const nextError = isoValue ? "" : required ? "تاریخ الزامی است." : "";
    setError(nextError);
    inputRef.current?.setCustomValidity(nextError);
    onChange?.(isoValue);
  }

  function finishEditing() {
    const trimmed = draft.trim();
    if (!trimmed) {
      const nextError = required ? "تاریخ الزامی است." : "";
      setError(nextError);
      inputRef.current?.setCustomValidity(nextError);
      if (!required) commit(null);
      return;
    }
    const isoValue = jalaliInputToIso(trimmed);
    const nextError = draftError(trimmed);
    if (!isoValue || nextError) {
      setError(nextError);
      inputRef.current?.setCustomValidity(nextError);
      return;
    }
    commit(isoValue);
  }

  function showCalendar() {
    const today = new Date().toISOString().slice(0, 10);
    const candidate = effectiveValue || today;
    const bounded = min && candidate < min ? min : max && candidate > max ? max : candidate;
    const selected = parseJalali(isoToJalaliInput(bounded));
    setViewYear(selected.year);
    setViewMonth(selected.month);
    setOpen((current) => !current);
  }

  const firstDayIso = jalaliInputToIso(`${viewYear}/${viewMonth}/1`);
  const firstDayOffset = firstDayIso
    ? (new Date(`${firstDayIso}T12:00:00Z`).getUTCDay() + 1) % 7
    : 0;
  const selectedJalali = isoToJalaliInput(effectiveValue);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayDisabled = Boolean((min && todayIso < min) || (max && todayIso > max));
  const days = Array.from(
    { length: firstDayOffset + monthLength(viewYear, viewMonth) },
    (_, index) => (index < firstDayOffset ? null : index - firstDayOffset + 1),
  );
  const currentJalaliYear = parseJalali(isoToJalaliInput(new Date().toISOString())).year;
  const minimumYear = min ? parseJalali(isoToJalaliInput(min)).year : (yearSelection ? currentJalaliYear - 120 : currentJalaliYear - 10);
  const maximumYear = max ? parseJalali(isoToJalaliInput(max)).year : currentJalaliYear + 20;
  const minimumMonth = min ? parseJalali(isoToJalaliInput(min)).month : 1;
  const maximumMonth = max ? parseJalali(isoToJalaliInput(max)).month : 12;
  const errorId = `${name ?? generatedId}-error`;
  return (
    <div className="relative block space-y-1" ref={rootRef}>
      <span className="sr-only">{ariaLabel}</span>
      <div className="relative">
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          aria-label={ariaLabel}
          className={`${className ?? ""} pl-12`}
          inputMode="numeric"
          onBlur={finishEditing}
          onChange={(event) => {
            const nextDraft = event.target.value;
            const nextError = draftError(nextDraft);
            const isoValue = jalaliInputToIso(nextDraft);
            setDraft(nextDraft);
            setError("");
            inputRef.current?.setCustomValidity(nextError);
            if (!nextDraft.trim()) {
              setCommitted(null);
              onChange?.(null);
            } else if (!nextError && isoValue) {
              setCommitted(isoValue);
              onChange?.(isoValue);
            }
          }}
          placeholder="۱۴۰۵/۰۵/۱۲"
          required={required}
          ref={inputRef}
          value={draft}
        />
        <button
          aria-expanded={open}
          aria-label={`باز کردن ${ariaLabel}`}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#174891] hover:bg-[#EAF3FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174891]"
          onClick={showCalendar}
          type="button"
        >
          <span aria-hidden="true">▦</span>
        </button>
      </div>
      {name ? <input name={name} type="hidden" value={committed ?? ""} /> : null}
      {error ? <span className="block text-xs text-red-700" id={errorId}>{error}</span> : null}
      {open ? (
        <JalaliCalendarModal ariaLabel={`انتخاب ${ariaLabel}`} onClose={() => setOpen(false)}>
        <div
          className="max-h-[min(30rem,calc(100dvh-2rem))] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border-2 border-[#A9C8EF] bg-white text-[#082f74] shadow-2xl"
          dir="rtl"
        >
          <header className="bg-[#174891] px-4 py-3 text-center text-white">
            <strong>انتخاب {ariaLabel}</strong>
            <span className="mt-0.5 block text-[11px] text-white/75">ماه و سال را مستقیم از گرید انتخاب کنید.</span>
          </header>
          <JalaliMonthYearPicker
            maxYear={maximumYear}
            maxMonth={maximumMonth}
            minYear={minimumYear}
            minMonth={minimumMonth}
            month={viewMonth}
            onChange={(next) => {
              setViewYear(next.year);
              setViewMonth(next.month);
            }}
            year={viewYear}
          />
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
              {weekDays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1" role="grid">
              {days.map((day, index) => {
                if (!day) return <span aria-hidden="true" key={`empty-${index}`} />;
                const jalaliValue = `${viewYear}/${String(viewMonth).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
                const isoValue = jalaliInputToIso(jalaliValue);
                const selected = jalaliValue === selectedJalali;
                const disabled = !isoValue || Boolean((min && isoValue < min) || (max && isoValue > max));
                return (
                  <button
                    aria-label={`${persianNumber(day)} ${JALALI_MONTH_NAMES[viewMonth - 1]} ${persianNumber(viewYear)}`}
                    aria-selected={selected}
                    className={`aspect-square rounded-lg text-sm hover:bg-[#EAF3FF] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${selected ? "bg-[#174891] text-white hover:bg-[#174891]" : ""}`}
                    disabled={disabled}
                    key={day}
                    onClick={() => {
                      commit(isoValue);
                      setOpen(false);
                    }}
                    role="gridcell"
                    type="button"
                  >
                    {persianNumber(day)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-sm">
              <button className="rounded-lg px-2 py-1 hover:bg-[#EAF3FF]" onClick={() => commit(null)} type="button">پاک کردن</button>
              <button
                className="rounded-lg px-2 py-1 font-bold text-[#174891] hover:bg-[#EAF3FF] disabled:cursor-not-allowed disabled:opacity-30"
                disabled={todayDisabled}
                onClick={() => {
                  commit(todayIso);
                  setOpen(false);
                }}
                type="button"
              >
                امروز
              </button>
            </div>
          </div>
        </div>
        </JalaliCalendarModal>
      ) : null}
    </div>
  );
}
