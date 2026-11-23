"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ComparisonKind = "hotel" | "tour";

export type ComparisonItem = {
  id: string;
  kind: ComparisonKind;
  title: string;
  href: string;
  imageUrl?: string | null;
  price: string;
  fields: { label: string; value: string }[];
};

type ComparisonContextValue = {
  items: ComparisonItem[];
  notice: string | null;
  toggle: (item: ComparisonItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  contains: (id: string) => boolean;
};

const ComparisonContext = createContext<ComparisonContextValue | null>(null);
const storageKey = "jahan-bastan-comparison";
const maximumItems = 3;

export function ComparisonProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as ComparisonItem[];
      // localStorage is the persisted source of truth after client hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(parsed)) setItems(parsed.slice(0, maximumItems));
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<ComparisonContextValue>(
    () => ({
      items,
      notice,
      toggle: (item) => {
        setNotice(null);
        setItems((current) => {
          if (current.some((entry) => entry.id === item.id)) {
            return current.filter((entry) => entry.id !== item.id);
          }
          if (current.length && current[0].kind !== item.kind) {
            setNotice("هتل و تور را جداگانه مقایسه کنید.");
            return current;
          }
          if (current.length >= maximumItems) {
            setNotice("حداکثر سه گزینه را می‌توانید مقایسه کنید.");
            return current;
          }
          return [...current, item];
        });
      },
      remove: (id) => setItems((current) => current.filter((entry) => entry.id !== id)),
      clear: () => {
        setNotice(null);
        setItems([]);
      },
      contains: (id) => items.some((entry) => entry.id === id),
    }),
    [items, notice],
  );

  return (
    <ComparisonContext.Provider value={value}>
      {children}
      <ComparisonTray />
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) throw new Error("Comparison components must be used inside ComparisonProvider.");
  return context;
}

export function CompareToggle({ item }: { item: ComparisonItem }) {
  const { contains, toggle } = useComparison();
  const selected = contains(item.id);

  return (
    <button
      aria-pressed={selected}
      className={
        "inline-flex min-h-10 items-center justify-center rounded-xl border px-3 text-xs font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent " +
        (selected
          ? "border-[#eb5d9f] bg-[#fff1f7] text-[#c72169]"
          : "border-border bg-white text-brand hover:border-[#eb5d9f] hover:bg-[#fff1f7]")
      }
      onClick={() => toggle(item)}
      type="button"
    >
      {selected ? "حذف از مقایسه" : "مقایسه"}
    </button>
  );
}

function ComparisonTray() {
  const { items, notice, remove, clear } = useComparison();
  if (!items.length) return null;

  return (
    <aside
      aria-label="گزینه‌های انتخاب‌شده برای مقایسه"
      className="comparison-tray fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-4xl rounded-3xl border border-brand/15 bg-white/95 p-3 shadow-[0_20px_55px_rgba(1,37,105,.25)] backdrop-blur-xl sm:bottom-5 sm:p-4"
      dir="rtl"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-brand">مقایسهٔ {items[0].kind === "hotel" ? "هتل‌ها" : "تور‌ها"}</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap" data-mobile-scroll>
            {items.map((item) => (
              <span className="inline-flex max-w-44 items-center gap-1.5 rounded-full bg-surface-muted py-1 ps-2 pe-1 text-xs font-bold text-brand" key={item.id}>
                <span className="truncate">{item.title}</span>
                <button aria-label={`حذف ${item.title} از مقایسه`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-white hover:text-danger" onClick={() => remove(item.id)} type="button">×</button>
              </span>
            ))}
            {Array.from({ length: maximumItems - items.length }).map((_, index) => (
              <span className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted" key={index}>گزینهٔ بعدی</span>
            ))}
          </div>
          {notice ? <p className="mt-2 text-xs font-bold text-[#c72169]" role="status" aria-live="polite" aria-atomic="true">{notice}</p> : null}
        </div>
        <div className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-2 sm:flex">
          <button className="min-h-10 rounded-xl px-3 text-xs font-bold text-muted hover:text-danger" onClick={clear} type="button">پاک کردن</button>
          <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#ef6fa9] px-4 text-sm font-black text-white shadow-[0_10px_22px_rgba(223,79,145,.3)] transition hover:-translate-y-0.5 hover:bg-[#df4f91]" href="/compare/">مقایسهٔ {items.length.toLocaleString("fa-IR")} گزینه</Link>
        </div>
      </div>
    </aside>
  );
}
