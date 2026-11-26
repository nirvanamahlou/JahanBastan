"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TourSection = "overview" | "dates" | "hotels" | "documents";

const items: Array<{ id: TourSection; label: string; hash: string }> = [
  { id: "overview", label: "معرفی تور", hash: "tour-overview" },
  { id: "dates", label: "اطلاعات پرواز", hash: "tour-dates" },
  { id: "hotels", label: "هتل‌ها و قیمت‌ها", hash: "tour-booking" },
  { id: "documents", label: "مدارک و قوانین", hash: "tour-documents" },
];

function sectionFromHash(
  hash: string,
  visibleItems: typeof items,
): TourSection | null {
  const value = hash === "#tour-flights-title" ? "tour-dates" : hash.replace(/^#/, "");
  return visibleItems.find((item) => item.hash === value)?.id ?? null;
}

export function TourDetailTabs({ sections, sticky = false }: { sections: TourSection[]; sticky?: boolean }) {
  const visibleItems = useMemo(
    () => items.filter((item) => sections.includes(item.id)),
    [sections],
  );
  const defaultSection = sections.includes("hotels")
    ? "hotels"
    : (visibleItems[0]?.id ?? "overview");
  const tabsRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<TourSection>(defaultSection);
  const [showHotelsUnderDates, setShowHotelsUnderDates] = useState(false);

  useEffect(() => {
    const syncWithHash = () =>
      setActive(sectionFromHash(window.location.hash, visibleItems) ?? defaultSection);
    const selectDeparture = (event: Event) => {
      const showHotels = (event as CustomEvent<{ showHotels?: boolean }>).detail?.showHotels;
      setShowHotelsUnderDates(Boolean(showHotels));
      if (sections.includes("dates")) setActive("dates");
    };
    syncWithHash();
    window.addEventListener("hashchange", syncWithHash);
    window.addEventListener("tour-departure-selected", selectDeparture);
    return () => {
      window.removeEventListener("hashchange", syncWithHash);
      window.removeEventListener("tour-departure-selected", selectDeparture);
    };
  }, [defaultSection, sections, visibleItems]);

  useEffect(() => {
    if (defaultSection !== "hotels" || window.location.hash) return;
    const frame = window.requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [defaultSection]);

  function select(section: TourSection, hash: string) {
    setActive(section);
    window.history.replaceState(null, "", `#${hash}`);
  }

  return (
    <>
      <nav ref={tabsRef} data-inline-tour-hotels={active === "dates" && showHotelsUnderDates ? "true" : undefined} aria-label="بخش‌های تور" className={`mt-6 flex scroll-mt-24 gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 shadow-sm ${sticky ? "sticky top-[calc(4.25rem+env(safe-area-inset-top,0px)+5px)] z-30 lg:top-2" : ""}`} role="tablist">
        {visibleItems.map((item) => (
          <button
            aria-controls={item.hash}
            aria-selected={active === item.id}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs sm:text-sm font-black transition ${active === item.id ? "bg-brand text-white" : "text-brand hover:bg-brand hover:text-white"}`}
            key={item.id}
            onClick={() => select(item.id, item.hash)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
      <style jsx global>{`
        .tour-tab-panel { display: none; }
        .tour-tab-panel[data-tour-section="${active}"] { display: block !important; }
        .tour-tab-grid[data-tour-section="${active}"] { display: grid !important; }
        [data-inline-tour-hotels="true"] ~ .tour-tab-panel[data-tour-section="hotels"] { display: block !important; }
        ${active !== "hotels" ? `@media (min-width: 1024px) { .tour-tab-layout { grid-template-columns: minmax(0, 1fr); } }` : ""}
      `}</style>
    </>
  );
}
