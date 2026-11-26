"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErpFlightOrders } from "@/components/content/erp-flight-orders";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type Item = { itemType: string; titleSnapshot: string };
type Booking = { id: number; bookingNumber: string; items: Item[]; status: string };
const ticketTypes = new Set(["flight", "train", "bus"]);
const action = "inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-bold text-brand hover:bg-surface-muted";

export function AccountTickets({ cartItems }: { cartItems: Item[] }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(PUBLIC_API_BASE_URL + "/account/bookings", {
          credentials: "include", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("bookings");
        const rows: Booking[] = await response.json();
        setBookings(rows.filter(row => row.items.length > 0 && row.items.every(item => ticketTypes.has(item.itemType))));
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  const drafts = cartItems.filter(item => ticketTypes.has(item.itemType));
  return <section className="grid min-w-0 gap-4 text-brand">
    <h1 className="border-b border-border pb-2 text-lg font-black sm:text-xl">بلیط‌های من</h1>
    <ErpFlightOrders />
    {state === "error" && <p role="alert">دریافت رزروها انجام نشد. صفحه را دوباره باز کنید.</p>}
    {(drafts.length > 0 || bookings.length > 0) && <section className="grid gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
      <h3 className="font-bold">رزروهای بلیط</h3>
      {drafts.length > 0 && <div className="grid justify-items-start gap-2">
        <strong>بلیط‌های در حال خرید</strong><p>{drafts.map(item => item.titleSnapshot).join("، ")}</p>
        <Link className={action} href="/account/?tab=tickets&checkout=1">ادامه خرید بلیط</Link>
      </div>}
      {bookings.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3">
        <div><strong>{row.items.map(item => item.titleSnapshot).join("، ")}</strong><p>شماره رزرو <bdi>{row.bookingNumber}</bdi></p></div>
        <Link className={action} href={`/payment/waiting/?booking=${row.id}`}>{row.status === "approved" ? "ادامه پرداخت" : "مشاهده بلیط و وضعیت سفارش"}</Link>
      </article>)}
    </section>}
  </section>;
}
