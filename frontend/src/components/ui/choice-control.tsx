import type { InputHTMLAttributes } from "react";

import { JalaliDateInput } from "@/components/admin/jalali-date-input";

type ChoiceControlProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type: "checkbox" | "radio";
  label: string;
  description?: string;
};

export function ChoiceControl({
  type,
  label,
  description,
  className = "",
  ...props
}: ChoiceControlProps) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-brand/40 ${className}`}>
      <input
        type={type}
        className="mt-1 size-4 accent-brand"
        {...props}
      />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-6 text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

type DateRangeProps = {
  startId: string;
  endId: string;
  startLabel?: string;
  endLabel?: string;
};

export function DateRange({
  startId,
  endId,
  startLabel = "از تاریخ",
  endLabel = "تا تاریخ",
}: DateRangeProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">بازه زمانی</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          {startLabel}
          <JalaliDateInput ariaLabel={startLabel} className="min-h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-brand focus:ring-4 focus:ring-accent" name={startId} value={null} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          {endLabel}
          <JalaliDateInput ariaLabel={endLabel} className="min-h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-brand focus:ring-4 focus:ring-accent" name={endId} value={null} />
        </label>
      </div>
    </fieldset>
  );
}
