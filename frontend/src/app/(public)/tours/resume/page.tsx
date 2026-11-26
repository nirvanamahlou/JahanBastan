import Link from "next/link";
import { TravelCheckout } from "@/components/checkout/travel-checkout";
import { Container } from "@/components/ui/container";
import { apiGet } from "@/lib/api/client";

export default async function ResumeTourPurchase() {
  const settings = await apiGet<{ socialLinks: Record<string, string> }>("/settings", { cache: "no-store" }).catch(() => null);
  return <Container className="max-w-5xl space-y-4 py-8">
    <Link className="font-bold underline" href="/account/?tab=trips">بازگشت به سفرهای من</Link>
    <h1 className="text-2xl font-black">ادامه خرید تور</h1>
    {settings?.socialLinks.onlineSalesEnabled === "true" ? <TravelCheckout tourPurchase /> : <p>ثبت سفارش آنلاین موقتاً غیرفعال است.</p>}
  </Container>;
}
