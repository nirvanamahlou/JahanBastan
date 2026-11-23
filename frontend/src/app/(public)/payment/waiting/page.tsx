import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "در حال انتظار اتصال درگاه پرداخت",
  robots: { index: false, follow: false },
};

export default function WaitingForPaymentPage() {
  return (
    <section className="site-container py-12 sm:py-16" dir="rtl">
      <div className="mx-auto grid max-w-xl gap-5 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-9">
        <span className="w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">وضعیت پرداخت</span>
        <h1 className="text-2xl font-black text-brand sm:text-3xl">در حال انتظار اتصال درگاه پرداخت</h1>
        <p className="text-sm leading-7 text-muted">پرداخت آنلاین این درخواست هنوز فعال نیست. وضعیت درخواست ثبت‌شده را در «سفرهای من» پیگیری کنید.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/account/?tab=trips" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-white">مشاهده سفرهای من</Link>
          <Link href="/cart/" className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-sm font-bold text-brand">بازگشت به سبد</Link>
        </div>
      </div>
    </section>
  );
}
