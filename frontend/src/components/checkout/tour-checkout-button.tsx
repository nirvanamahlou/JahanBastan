"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import type { TourCheckoutSelection } from "./combined-tour-checkout";

type Props = {
  className?: string;
  disabled?: boolean;
  selection: TourCheckoutSelection;
  children: ReactNode;
};

export function TourCheckoutButton({ className, disabled, selection, children }: Props) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  function continueToCheckout() {
    setFailed(false);
    try {
      const selectionId = crypto.randomUUID();
      const { pathname, search } = window.location;
      sessionStorage.setItem(`tour-checkout:${selectionId}`, JSON.stringify({
        selection,
        returnHref: `${pathname}${search}#tour-booking`,
      }));
      router.push(`/tours/reservation/?selection=${selectionId}`);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={continueToCheckout}>{children}</button>
      {failed && <p role="alert" className="text-xs text-red-700">باز کردن صفحهٔ رزرو انجام نشد. دوباره تلاش کنید.</p>}
    </>
  );
}
