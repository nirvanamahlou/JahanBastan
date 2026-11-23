"use client";

import { useRef, useState } from "react";
import { TravelSearchIcon } from "@/components/search/travel-search-icon";

import { JalaliCalendarModal } from "@/components/ui/jalali-calendar-modal";
import {
  JALALI_MONTH_NAMES,
  JalaliMonthYearPicker,
} from "@/components/ui/jalali-month-year-picker";
import { isoToJalaliInput, jalaliInputToIso } from "@/lib/persian-date";

const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

type JalaliMonth = { year: number; month: number };

function parseJalali(value: string): JalaliMonth {
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

function shiftMonth({ year, month }: JalaliMonth, offset: number): JalaliMonth {
  const zeroBased = year * 12 + month - 1 + offset;
  return {
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
  };
}

type TripType = "one_way" | "round_trip";
type SelectionStep = "departure" | "return";

type JalaliDateRangeInputProps = {
  compact?: boolean;
  calendarSize?: "compact" | "regular";
  initialDeparture?: string | null;
  initialReturn?: string | null;
  initialTripType?: TripType;
  omitInitialTripType?: boolean;
  showTripType?: boolean;
  stackTripType?: boolean;
  dateLabels?: { departure: string; return: string; field?: string };
  className?: string;
  appearance?: "light" | "dark";
  layout?: "default" | "hero";
};

export function JalaliDateRangeInput({
  compact = false,
  calendarSize = compact ? "compact" : "regular",
  initialDeparture = null,
  initialReturn = null,
  initialTripType = "round_trip",
  omitInitialTripType = false,
  showTripType = true,
  stackTripType = false,
  dateLabels,
  className = "",
  appearance = "light",
  layout = "default",
}: JalaliDateRangeInputProps) {
  const labels = dateLabels ?? { departure: "رفت", return: "برگشت" };
  const isDark = appearance === "dark";
  const controlTheme = isDark
    ? "border border-[#6382bc]/65 bg-[#071a4c]/65 text-white"
    : "border-2 border-brand/20 bg-white/90 text-foreground";
  const controlSize = isDark
    ? "min-h-12 text-sm"
    : compact
      ? "min-h-11 sm:min-h-10 xl:min-h-9 sm:text-xs xl:text-[11px]"
      : "min-h-11";
  const buttonTheme = isDark
    ? "hover:bg-white/10 focus-visible:ring-white/80"
    : "hover:bg-sky-50/85 focus-visible:ring-brand";
  const today = new Date().toISOString().slice(0, 10);
  const todayJalali = parseJalali(isoToJalaliInput(today));
  const initial = parseJalali(isoToJalaliInput(initialDeparture || today));
  const [tripType, setTripType] = useState<TripType>(initialTripType);
  const [tripTypeChosen, setTripTypeChosen] = useState(!omitInitialTripType);
  const [selectionStep, setSelectionStep] = useState<SelectionStep>("departure");
  const [departure, setDeparture] = useState<string | null>(initialDeparture);
  const [returnDate, setReturnDate] = useState<string | null>(
    initialTripType === "round_trip" ? initialReturn : null,
  );
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [view, setView] = useState(initial);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  function applyFlightDates() {
    window.requestAnimationFrame(() => root.current?.closest<HTMLFormElement>("form[data-live-flight-form]")?.requestSubmit());
  }

  function selectDate(isoValue: string) {
    if (isoValue < today) return;
    if (tripType === "one_way" && selectionStep === "return") {
      setSelectionStep("departure");
      return;
    }

    if (selectionStep === "departure") {
      setDeparture(isoValue);
      if (returnDate && returnDate < isoValue) setReturnDate(null);
      setHoverDate(null);
      if (tripType === "one_way") {
        setOpen(false);
        applyFlightDates();
      } else {
        setSelectionStep("return");
      }
      return;
    }

    if (!departure || isoValue < departure) {
      setDeparture(isoValue);
      setReturnDate(null);
      setSelectionStep("return");
      setHoverDate(null);
      return;
    }

    setReturnDate(isoValue);
    setHoverDate(null);
    setOpen(false);
    applyFlightDates();
  }

  function openPicker(step: SelectionStep) {
    if (step === "return" && tripType === "one_way") return;
    const selectedDate = step === "return" ? returnDate ?? departure : departure;
    setView(selectedDate && selectedDate >= today ? parseJalali(isoToJalaliInput(selectedDate)) : todayJalali);
    setSelectionStep(step === "return" && !departure ? "departure" : step);
    setOpen(true);
  }

  function changeTripType(nextTripType: TripType) {
    setTripTypeChosen(true);
    setTripType(nextTripType);
    if (nextTripType === "one_way") {
      setReturnDate(null);
      setSelectionStep("departure");
    }
    applyFlightDates();
  }

  const secondView = shiftMonth(view, 1);
  const currentJalaliYear = todayJalali.year;
  const maximumJalaliYear = currentJalaliYear + 20;
  const canShowSecondMonth = secondView.year <= maximumJalaliYear;
  const departureLabel = departure ? isoToJalaliInput(departure) : "";
  const returnLabel = returnDate ? isoToJalaliInput(returnDate) : "";

  return (
    <div ref={root} data-date-range data-date-layout={layout} className={`relative grid h-full min-w-0 gap-1 ${compact ? "col-span-full sm:col-span-2" : ""} ${className}`}>
      <div className="grid gap-1.5">
        <span className="block text-xs font-bold text-foreground">{labels.field ?? (showTripType ? "نوع و تاریخ بلیت" : "تاریخ سفر")}</span>
        <div
          data-date-controls
          className={`grid min-w-0 gap-2 sm:items-end ${
            showTripType
              ? stackTripType
                ? "grid-cols-1"
                : compact
                  ? "sm:grid-cols-[minmax(8.5rem,0.9fr)_minmax(9rem,1.1fr)]"
                  : "sm:grid-cols-[15.5rem_minmax(10rem,1fr)]"
              : "sm:grid-cols-1"
          }`}
          style={stackTripType ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
        >
          {showTripType ? (
          <div className={`grid w-full min-w-0 grid-cols-2 overflow-hidden rounded-xl p-1 shadow-inner ${controlTheme} ${controlSize} ${stackTripType ? "order-1" : ""}`} data-trip-type aria-label="نوع سفر">
            <button aria-pressed={tripType === "one_way"} className={`h-full min-h-0 min-w-0 rounded-lg px-1.5 text-center text-xs font-black leading-5 whitespace-normal transition ${tripType === "one_way" ? "bg-accent/70 text-brand shadow-sm" : "text-muted hover:bg-sky-50/80 hover:text-brand"}`} onClick={() => changeTripType("one_way")} type="button">یک‌طرفه</button>
            <button aria-pressed={tripType === "round_trip"} className={`h-full min-h-0 min-w-0 rounded-lg px-1.5 text-center text-xs font-black leading-5 whitespace-normal transition ${tripType === "round_trip" ? "bg-accent/70 text-brand shadow-sm" : "text-muted hover:bg-sky-50/80 hover:text-brand"}`} onClick={() => changeTripType("round_trip")} type="button">رفت و برگشت</button>
          </div>
        ) : null}
          <div data-date-values className={`grid w-full min-w-0 flex-1 ${tripType === "round_trip" ? compact ? "grid-cols-[minmax(3.75rem,1fr)_minmax(3.75rem,1fr)]" : "grid-cols-[minmax(4.75rem,1fr)_minmax(4.75rem,1fr)]" : "grid-cols-1"} overflow-hidden rounded-xl ${controlTheme} text-right shadow-sm ${controlSize} ${stackTripType ? "order-2 mt-1" : ""}`}>
        <button aria-label="انتخاب تاریخ بلیت رفت" className={`flex min-w-0 flex-col justify-center px-3 text-right transition ${buttonTheme} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${tripType === "round_trip" ? "border-l-2 border-brand/15" : ""} ${open && selectionStep === "departure" ? "bg-accent/45" : ""}`} onClick={() => openPicker("departure")} type="button">
          <small className={"whitespace-nowrap text-[10px] " + (isDark ? "text-white/70" : "text-muted")}>{labels.departure}</small>
          {departureLabel ? <strong className="truncate font-bold">{departureLabel}</strong> : layout === "hero" ? <span data-date-placeholder>انتخاب تاریخ</span> : null}
          {layout === "hero" ? <TravelSearchIcon icon="calendar" data-date-icon /> : null}
        </button>
        {tripType === "round_trip" ? (
          <button aria-label="انتخاب تاریخ بلیت برگشت" className={`flex min-w-0 flex-col justify-center px-3 text-right transition ${buttonTheme} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${open && selectionStep === "return" ? "bg-accent/45" : ""}`} onClick={() => openPicker("return")} type="button">
            <small className={"whitespace-nowrap text-[10px] " + (isDark ? "text-white/70" : "text-muted")}>{labels.return}</small>
            {returnLabel ? <strong className="truncate font-bold">{returnLabel}</strong> : layout === "hero" ? <span data-date-placeholder>انتخاب تاریخ</span> : null}
            {layout === "hero" ? <TravelSearchIcon icon="calendar" data-date-icon /> : null}
          </button>
        ) : null}
      </div>
        </div>
      </div>
      {showTripType ? <input name="tripType" type="hidden" value={tripTypeChosen || returnDate ? tripType : ""} /> : null}
      <input name="departureFrom" type="hidden" value={departure ?? ""} />
      <input name="departureTo" type="hidden" value={tripType === "round_trip" ? returnDate ?? "" : ""} />
      {open ? (
        <JalaliCalendarModal ariaLabel="انتخاب بازه تاریخ شمسی" onClose={() => setOpen(false)}>
        <div
          className={`${calendarSize === "compact" ? "max-h-[25rem] w-[min(22rem,calc(100vw-1.5rem))]" : "max-h-[min(34rem,calc(100dvh-2rem))] w-[min(34rem,calc(100vw-1.5rem))]"} overscroll-contain overflow-y-auto rounded-2xl border-2 border-brand/45 bg-white text-[#082f74] shadow-2xl`}
          dir="rtl"
        >
          <header className="bg-[#174891] px-3 py-2 text-center text-white">
            <div>
              <strong id="jalali-range-dialog-title" className={`block ${compact ? "text-xs" : "text-sm"}`}>{tripType === "one_way" ? "انتخاب تاریخ بلیت رفت" : "انتخاب تاریخ رفت و برگشت"}</strong>
              <span className="text-[10px] text-white/80">{tripType === "one_way" ? "تاریخ بلیت رفت را انتخاب کنید" : selectionStep === "departure" ? "ابتدا تاریخ بلیت رفت را انتخاب کنید" : "اکنون تاریخ بلیت برگشت را انتخاب کنید"}</span>
            </div>
          </header>
          <JalaliMonthYearPicker
            maxYear={maximumJalaliYear}
            minYear={currentJalaliYear}
            minMonth={todayJalali.month}
            month={view.month}
            onChange={setView}
            year={view.year}
          />
          <div className={`grid gap-1 p-2.5 ${calendarSize === "regular" ? "md:grid-cols-2 md:divide-x md:divide-x-reverse md:divide-border" : ""}`}>
            <MonthCalendar
              departure={departure}
              hoverDate={hoverDate}
              month={view}
              minDate={today}
              onHover={setHoverDate}
              onSelect={selectDate}
              returnDate={returnDate}
            />
            {calendarSize === "regular" && canShowSecondMonth ? (
              <MonthCalendar
                departure={departure}
                hoverDate={hoverDate}
                month={secondView}
                minDate={today}
                onHover={setHoverDate}
                onSelect={selectDate}
                returnDate={returnDate}
              />
            ) : null}
          </div>
          <footer className="flex flex-col gap-2 border-t border-border bg-surface-muted px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted">
              {departure ? `رفت ${isoToJalaliInput(departure)}` : "رفت انتخاب نشده"}
              {tripType === "round_trip" ? returnDate ? ` — برگشت ${isoToJalaliInput(returnDate)}` : " — برگشت انتخاب نشده" : " — سفر یک‌طرفه"}
            </p>
            <div className="flex gap-2">
              <button className="rounded-lg px-3 py-1.5 text-xs font-bold text-muted hover:bg-white" onClick={() => { setDeparture(null); setReturnDate(null); setHoverDate(null); if (root.current?.closest("form[data-live-flight-form]")) { setOpen(false); applyFlightDates(); } }} type="button">پاک کردن</button>
              <button className="rounded-lg bg-[#174891] px-5 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!departure || (tripType === "round_trip" && !returnDate)} onClick={() => { setOpen(false); applyFlightDates(); }} type="button">تأیید تاریخ بلیت</button>
            </div>
          </footer>
        </div>
        </JalaliCalendarModal>
      ) : null}
    </div>
  );
}

function MonthCalendar({
  month,
  minDate,
  departure,
  returnDate,
  hoverDate,
  onSelect,
  onHover,
}: {
  month: JalaliMonth;
  minDate: string;
  departure: string | null;
  returnDate: string | null;
  hoverDate: string | null;
  onSelect: (value: string) => void;
  onHover: (value: string | null) => void;
}) {
  const firstDayIso = jalaliInputToIso(`${month.year}/${month.month}/1`);
  const firstDayOffset = firstDayIso
    ? (new Date(`${firstDayIso}T12:00:00Z`).getUTCDay() + 1) % 7
    : 0;
  const days = Array.from(
    { length: firstDayOffset + monthLength(month.year, month.month) },
    (_, index) => (index < firstDayOffset ? null : index - firstDayOffset + 1),
  );
  const rangeEnd = returnDate ?? (
    departure && hoverDate && hoverDate >= departure ? hoverDate : null
  );

  return (
    <section className="p-1.5" aria-label={`${JALALI_MONTH_NAMES[month.month - 1]} ${persianNumber(month.year)}`}>
      <h3 className="mb-1.5 text-center text-xs font-black">{JALALI_MONTH_NAMES[month.month - 1]} {persianNumber(month.year)}</h3>
      <div className="grid grid-cols-7 text-center text-[10px] text-slate-500">
        {weekDays.map((day, index) => <span className="py-0.5" key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => onHover(null)} role="grid">
        {days.map((day, index) => {
          if (!day) return <span aria-hidden="true" className="aspect-square" key={`empty-${index}`} />;
          const jalaliValue = `${month.year}/${String(month.month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
          const isoValue = jalaliInputToIso(jalaliValue);
          if (!isoValue) return null;
          const disabled = isoValue < minDate;
          const endpoint = isoValue === departure || isoValue === returnDate;
          const previewEndpoint = !returnDate && isoValue === rangeEnd;
          const inRange = Boolean(
            departure && rangeEnd && isoValue > departure && isoValue < rangeEnd,
          );
          return (
            <button
              aria-label={`${persianNumber(day)} ${JALALI_MONTH_NAMES[month.month - 1]} ${persianNumber(month.year)}`}
              aria-selected={endpoint}
              className={`aspect-square text-[11px] transition first:rounded-r-lg last:rounded-l-lg disabled:cursor-not-allowed disabled:text-slate-300 ${
                endpoint
                  ? "rounded-lg bg-[#174891] font-black text-white"
                  : previewEndpoint
                    ? "rounded-lg bg-[#2E69B2] font-black text-white"
                    : inRange
                      ? "bg-[#D8EAFF] text-[#174891]"
                      : "rounded-lg hover:bg-[#EAF3FF]"
              }`}
              disabled={disabled}
              key={day}
              onClick={() => onSelect(isoValue)}
              onMouseEnter={() => { if (!disabled) onHover(isoValue); }}
              role="gridcell"
              type="button"
            >
              {persianNumber(day)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
