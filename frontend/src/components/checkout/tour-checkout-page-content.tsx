"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CombinedTourCheckout, type TourCheckoutSelection } from "./combined-tour-checkout";

type SavedSelection = { selection: TourCheckoutSelection; returnHref: string };

export function TourCheckoutPageContent({ selectionId }: { selectionId: string | null }) {
  const [saved, setSaved] = useState<SavedSelection | null | undefined>(undefined);

  useEffect(() => {
    let stored: SavedSelection | null = null;
    if (selectionId) {
      try {
        const raw = sessionStorage.getItem(`tour-checkout:${selectionId}`);
        if (raw) stored = JSON.parse(raw);
      } catch {
        // The visitor can return to the tour list if the selection is unavailable.
      }
    }
    setSaved(stored?.selection?.tourId ? stored : null);
  }, [selectionId]);

  if (saved === undefined) return <p role="status">در حال آماده‌سازی رزرو…</p>;

  const returnHref = saved?.returnHref && /^\/tours\/[^/\\?#]+\/?(?:\?[^#]*)?#tour-booking$/.test(saved.returnHref)
    ? saved.returnHref
    : "/tours/";

  return (
    <>
      <Link href={returnHref} className="justify-self-start text-sm font-bold text-brand underline underline-offset-4">
        {returnHref === "/tours/" ? "بازگشت به فهرست تورها" : "بازگشت به هتل‌ها و قیمت‌ها"}
      </Link>
      {saved ? <CombinedTourCheckout {...saved.selection} /> : (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">برای ادامه، تور و اتاق موردنظر را دوباره انتخاب کنید.</p>
      )}
    </>
  );
}
