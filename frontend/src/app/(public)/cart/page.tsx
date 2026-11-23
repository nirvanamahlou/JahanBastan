import type { Metadata } from "next";

import { TravelCheckout as CartPanel } from "@/components/checkout/travel-checkout";
import { Container } from "@/components/ui/container";
import { apiGet } from "@/lib/api/client";

type Settings = { socialLinks: Record<string, string> };

export const metadata: Metadata = { title: "سبد سفر", description: "بررسی قیمت و ظرفیت و ارسال درخواست رزرو در جهان باستان" };

export default async function CartPage() {
  const settings = await apiGet<Settings>("/settings", { cache: "no-store" }).catch(() => null);
  const onlineSalesEnabled = settings?.socialLinks.onlineSalesEnabled === "true";
  return <section className="bg-background py-10 sm:py-14"><Container className="max-w-5xl"><div className="mb-7"><p className="text-sm font-bold text-accent-strong">بررسی انتخاب‌های سفر</p><h1 className="mt-1 text-3xl font-black text-brand">سبد سفر و درخواست رزرو</h1></div>{onlineSalesEnabled ? <CartPanel /> : <div className="rounded-2xl border border-border bg-white p-6 text-sm leading-7 text-muted">ثبت سفارش آنلاین موقتاً غیرفعال است. انتخاب‌های قبلی شما حفظ شده‌اند؛ برای هماهنگی با کارشناسان ما تماس بگیرید.</div>}</Container></section>;
}
