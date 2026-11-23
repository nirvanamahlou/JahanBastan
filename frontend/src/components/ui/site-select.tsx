"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type SiteSelectOption = {
  description?: string;
  label: string;
  value: string;
};

type SiteSelectProps = {
  ariaLabel: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id: string;
  name?: string;
  onValueChange?: (value: string) => void;
  options: ReadonlyArray<SiteSelectOption>;
  placeholder?: string;
  required?: boolean;
  searchable?: boolean;
  value?: string;
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

export function SiteSelect({
  ariaLabel,
  className = "",
  defaultValue = "",
  disabled = false,
  id,
  name,
  onValueChange,
  options,
  placeholder = "انتخاب کنید",
  required = false,
  searchable = false,
  value,
}: SiteSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const selectedValue = value ?? internalValue;

  const uniqueOptions = useMemo(
    () => Array.from(new Map(options.map((option) => [option.value, option])).values()),
    [options],
  );
  const visibleOptions = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return uniqueOptions;
    return uniqueOptions.filter((option) =>
      normalize(`${option.label} ${option.description ?? ""}`).includes(needle),
    );
  }, [query, uniqueOptions]);
  const selected = uniqueOptions.find((option) => option.value === selectedValue);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    window.requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else optionRefs.current[activeIndex]?.focus();
    });
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [activeIndex, open, searchable]);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const reset = () => {
      if (value === undefined) setInternalValue(defaultValue);
      setInvalid(false);
      setOpen(false);
      setQuery("");
    };
    const validate = (event: Event) => {
      if (!required || selectedValue) return;
      event.preventDefault();
      setInvalid(true);
      setOpen(true);
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    };
    form.addEventListener("reset", reset);
    form.addEventListener("submit", validate, true);
    return () => {
      form.removeEventListener("reset", reset);
      form.removeEventListener("submit", validate, true);
    };
  }, [defaultValue, required, selectedValue, value]);

  function choose(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setInvalid(false);
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => {
      buttonRef.current?.focus();
      rootRef.current?.closest<HTMLFormElement>("form[data-live-flight-form]")?.requestSubmit();
    });
  }

  function showOptions() {
    const selectedIndex = uniqueOptions.findIndex((option) => option.value === selectedValue);
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      showOptions();
      return;
    }
    const lastIndex = Math.max(0, visibleOptions.length - 1);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowDown"
          ? Math.min(lastIndex, activeIndex + 1)
          : Math.max(0, activeIndex - 1);
    setActiveIndex(nextIndex);
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  }

  return (
    <div className="relative min-w-0" onKeyDown={handleKeyDown} ref={rootRef}>
      {name ? <input name={name} type="hidden" value={selectedValue} /> : null}
      <button
        aria-controls={`${id}-options`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid}
        aria-label={ariaLabel}
        aria-required={required}
        className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-white px-3 text-right text-sm font-bold text-brand outline-none transition hover:border-brand/45 focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted ${invalid ? "border-danger ring-2 ring-danger/15" : "border-border"} ${className}`}
        disabled={disabled}
        id={id}
        onClick={() => {
          if (open) setOpen(false);
          else showOptions();
        }}
        ref={buttonRef}
        role="combobox"
        type="button"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-muted"}`}>
          {selected?.label || placeholder}
        </span>
        <span aria-hidden="true" className={`shrink-0 text-brand transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-[80] mt-2 min-w-[13rem] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_50px_rgba(1,37,105,0.18)]">
          {searchable ? (
            <div className="border-b border-border bg-surface-muted p-2.5">
              <input
                aria-label={`جستجو در ${ariaLabel}`}
                className="min-h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-accent"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder={`جستجوی ${ariaLabel}`}
                ref={searchRef}
                type="search"
                value={query}
              />
            </div>
          ) : null}
          <ul className="max-h-64 overflow-y-auto overscroll-contain p-1.5" id={`${id}-options`} role="listbox">
            {visibleOptions.map((option, index) => {
              const isSelected = option.value === selectedValue;
              return (
                <li key={`${option.value}-${option.label}`} role="presentation">
                  <button
                    aria-selected={isSelected}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${isSelected ? "bg-brand text-white" : "text-foreground hover:bg-brand-soft hover:text-brand"}`}
                    onClick={() => choose(option.value)}
                    ref={(element) => { optionRefs.current[index] = element; }}
                    role="option"
                    tabIndex={index === activeIndex ? 0 : -1}
                    type="button"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate font-bold">{option.label}</strong>
                      {option.description ? <span className={`mt-0.5 block truncate text-xs ${isSelected ? "text-white/75" : "text-muted"}`}>{option.description}</span> : null}
                    </span>
                    {isSelected ? <span aria-hidden="true" className="shrink-0">✓</span> : null}
                  </button>
                </li>
              );
            })}
            {!visibleOptions.length ? <li className="px-3 py-7 text-center text-sm text-muted">موردی پیدا نشد.</li> : null}
          </ul>
        </div>
      ) : null}
      {invalid ? <p className="mt-1 text-xs font-bold text-danger" role="alert">انتخاب این گزینه الزامی است.</p> : null}
    </div>
  );
}
