"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { addGuestCartIntent, notifyCartUpdated, type GuestCartPayload } from "@/lib/guest-cart";
import { useOnlineSalesEnabled } from "@/components/online-sales-provider";

type CartAddButtonProps = {
  onPendingChange?: (pending: boolean) => void;
  onAdded?: (id: number) => void;
  itemType: "tour" | "flight" | "train" | "bus";
  tourId?: number;
  travelServiceId?: number;
  tourDepartureId?: number;
  hotelPackageId?: number;
  tourHotelPriceId?: number;
  combinedDeparturePriceId?: number;
  roomSelection?: Record<string, number>;
  disabled?: boolean;
  idleLabel?: string;
  successLabel?: string;
  className?: string;
  buttonClassName?: string;
};

function saveForGuest(payload: GuestCartPayload, router: ReturnType<typeof useRouter>) {
  addGuestCartIntent(payload, document.title || "انتخاب سفر");
  router.push(payload.itemType === "tour" ? "/tours/resume/" : "/account/?tab=tickets&checkout=1");
}

function CartFinalizationNotice({ href }: { href: string }) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-right"
      role="status"
    >
      <p className="text-xs font-bold leading-6 text-emerald-900">
        انتخاب شما ثبت شد. برای تکمیل مشخصات و نهایی‌کردن خرید ادامه دهید.
      </p>
      <Link
        className="mt-2 inline-flex min-h-10 items-center justify-center rounded-xl bg-brand px-4 text-xs font-black text-white transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
        href={href}
      >
        ادامه خرید
      </Link>
    </div>
  );
}

export function CartAddButton({
  onAdded,
  onPendingChange,
  itemType,
  tourId,
  travelServiceId,
  tourDepartureId,
  hotelPackageId,
  tourHotelPriceId,
  combinedDeparturePriceId,
  roomSelection,
  disabled = false,
  idleLabel = "انتخاب و ادامه خرید",
  successLabel = "انتخاب شد",
  className = "",
  buttonClassName = "",
}: CartAddButtonProps) {
  const onlineSalesEnabled = useOnlineSalesEnabled();
  const [state, setState] = useState<"idle" | "loading" | "added" | "error">("idle");
  const router = useRouter();
  const requiresPassengerDetails = itemType !== "tour";

  async function addToCart() {
    setState("loading");
    onPendingChange?.(true);
    const payload: GuestCartPayload = itemType === "tour"
      ? { itemType, tourId, tourDepartureId, hotelPackageId, tourHotelPriceId, combinedDeparturePriceId, roomSelection }
      : { itemType, travelServiceId };
    const response = await fetch(PUBLIC_API_BASE_URL + "/account/cart", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (response?.status === 401) {
      onPendingChange?.(false);
      saveForGuest(payload, router);
      return;
    }
    if (response?.ok) {
      setState("added");
      notifyCartUpdated();
      if (onAdded) {
        const item = await response.json().catch(() => null);
        if (Number.isSafeInteger(item?.id)) onAdded(item.id);
      }
    } else {
      setState("error");
    }
    onPendingChange?.(false);
  }

  return (
    <div className={"space-y-1 " + className}>
      <button
        className={"inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60 " + buttonClassName}
        disabled={!onlineSalesEnabled || disabled || state === "loading" || state === "added"}
        onClick={() => void addToCart()}
        type="button"
      >
        {!onlineSalesEnabled ? "تماس حاصل فرمایید" : state === "loading" ? "در حال افزودن…" : state === "added" ? successLabel : idleLabel}
      </button>
      {state === "added" ? (
        <CartFinalizationNotice href={requiresPassengerDetails ? "/account/?tab=tickets&checkout=1" : "/tours/resume/"} />
      ) : null}
      {state === "error" ? <p className="text-center text-xs text-red-700">ثبت انتخاب انجام نشد. دوباره تلاش کنید.</p> : null}
    </div>
  );
}

export function FlightCartAddButton({
  travelServiceIds,
  className = "",
  buttonClassName = "",
  idleLabel = "خرید بلیط رفت‌وبرگشت",
  successLabel = "هر دو بلیط انتخاب شد",
}: {
  travelServiceIds: number[];
  className?: string;
  buttonClassName?: string;
  idleLabel?: string;
  successLabel?: string;
}) {
  const onlineSalesEnabled = useOnlineSalesEnabled();
  const [state, setState] = useState<"idle" | "loading" | "added" | "error">("idle");
  const router = useRouter();
  const ids = [...new Set(travelServiceIds)];

  async function addToCart() {
    setState("loading");
    const payloads = ids.map((travelServiceId) => ({ itemType: "flight" as const, travelServiceId }));
    const responses = await Promise.all(payloads.map((payload) => fetch(PUBLIC_API_BASE_URL + "/account/cart", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null)));

    if (responses.some((response) => response?.status === 401)) {
      payloads.forEach((payload) => saveForGuest(payload, router));
      return;
    }
    if (responses.some((response) => response?.ok)) notifyCartUpdated();
    if (responses.every((response) => response?.ok)) {
      setState("added");
    } else {
      setState("error");
    }
  }

  return (
    <div className={"space-y-1 " + className}>
      <button
        className={"inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-brand/90 disabled:opacity-60 " + buttonClassName}
        disabled={!onlineSalesEnabled || !ids.length || state === "loading" || state === "added"}
        onClick={() => void addToCart()}
        type="button"
      >
        {!onlineSalesEnabled ? "تماس حاصل فرمایید" : state === "loading" ? "در حال افزودن…" : state === "added" ? successLabel : idleLabel}
      </button>
      {state === "added" ? <CartFinalizationNotice href="/account/?tab=tickets&checkout=1" /> : null}
      {state === "error" ? <p className="text-xs text-red-700">افزودن هر دو بلیط ناموفق بود. دوباره تلاش کنید.</p> : null}
    </div>
  );
}
