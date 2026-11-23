"use client";

import { Time24Input } from "@/components/ui/time-24-input";

import { useId } from "react";

type Props = {
  className: string;
  label: string;
  name?: string;
  onChange: (value: string) => void;
  value: string;
};

export function ClearableTimeInput({ className, label, name, onChange, value }: Props) {
  const generatedId = useId();
  const inputId = `admin-time-${generatedId.replace(/:/g, "")}`;

  return (
    <div className="space-y-1 text-xs font-bold">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <label htmlFor={inputId}>{label}</label>
        <button
          aria-label={`پاک کردن ${label}`}
          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-black text-red-700 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!value}
          onClick={() => onChange("")}
          type="button"
        >
          پاک کردن
        </button>
      </div>
      <Time24Input
        aria-label={label}
        className={className}
        id={inputId}
        name={name}
        onValueChange={onChange}
        value={value}
      />
    </div>
  );
}
