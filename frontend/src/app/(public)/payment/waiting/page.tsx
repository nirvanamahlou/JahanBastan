import type { Metadata } from "next";
import Link from "next/link";
import { OrderPaymentStatus } from "@/components/payment/order-payment-status";

export const metadata: Metadata = {
  title: "وضعیت سفارش و پرداخت",
  robots: { index: false, follow: false },
};

export default async function WaitingForPaymentPage({ searchParams }: { searchParams: Promise<{ tour?: string; flight?: string; booking?: string }> }) {
  const { flight, booking } = await searchParams;
  const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
  const order = typeof booking === "string" && /^[1-9]\d*$/.test(booking) ? {kind: "booking" as const, id: booking} :
    typeof flight === "string" && uuid.test(flight) ? {kind: "flight" as const, id: flight} : null;
  return (
    <section className="site-container py-12 sm:py-16" dir="rtl">
      <div className="mx-auto grid max-w-xl gap-5 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-9">
        <span className="w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">وضعیت پرداخت</span>
        <h1 className="text-2xl font-black text-brand sm:text-3xl">وضعیت سفارش و پرداخت</h1>
        {order ? <OrderPaymentStatus key={order.kind + order.id} {...order} /> : <p>برای مشاهدهٔ وضعیت پرداخت، سفارش خود را از «سفرهای من» انتخاب کنید.</p>}
        <div className="flex flex-wrap gap-3">
          <Link href="/account/?tab=trips" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-white">مشاهده سفرهای من</Link>
          <Link href="/account/?tab=tickets" className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-sm font-bold text-brand">مشاهده بلیط‌های من</Link>
        </div>
      </div>
    </section>
  );
}
