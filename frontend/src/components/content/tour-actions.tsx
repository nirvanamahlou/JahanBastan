"use client";

import { useState } from "react";

import { SaveTourButton } from "@/components/customer-commerce-actions";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

export function TourActions({
  showBookingAction,
  slug,
  title,
  tourId,
}: {
  showBookingAction: boolean;
  slug: string;
  title: string;
  tourId: number;
}) {
  const [message, setMessage] = useState("");
  const packageUrl = `${PUBLIC_API_BASE_URL}/tours/${encodeURIComponent(slug)}/package.pdf`;

  async function share() {
    const data = { title, text: `مشاهده ${title}`, url: window.location.href };
    if (navigator.share) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setMessage("لینک تور کپی شد.");
  }

  return (
    <div className="grid max-w-sm grid-cols-2 gap-2">
      <SaveTourButton className="w-full" tourId={tourId} />
      <a
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/40 bg-white/90 px-3 py-2 text-center text-sm font-bold text-brand shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        href={packageUrl}
      >
        دانلود PDF پکیج
      </a>
      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/40 bg-white/90 px-3 py-2 text-center text-sm font-bold text-brand shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={share}
        type="button"
      >
        اشتراک‌گذاری
      </button>
      {showBookingAction ? (
        <button className="min-h-11 w-full rounded-xl bg-accent-strong px-3 py-2 text-center text-xs font-black leading-5 text-white shadow-[0_10px_22px_rgba(223,79,145,0.28)] transition hover:-translate-y-0.5 hover:bg-accent-strong/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => { window.location.hash = "tour-booking"; window.requestAnimationFrame(() => document.getElementById("tour-booking")?.scrollIntoView({ behavior: "smooth", block: "center" })); }} type="button">انتخاب تاریخ و هتل خرید</button>
      ) : null}
      <span aria-live="polite" className="sr-only">{message}</span>
    </div>
  );
}