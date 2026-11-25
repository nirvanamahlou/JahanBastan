import type { Metadata } from "next";
import Link from "next/link";

import { ErpFlightCheckout } from "@/components/content/erp-flight-checkout";
import type { ErpFlightRate } from "@/components/content/erp-flight-result-card";
import { Container } from "@/components/ui/container";
import { apiGet } from "@/lib/api/client";
import { parseFlightCheckoutParams } from "@/lib/erp-flight-checkout-navigation";

export const metadata: Metadata = {
  title: "خرید بلیت پرواز",
  robots: { index: false, follow: false },
};

export default async function FlightCheckoutPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { resultsHref, selection } = parseFlightCheckoutParams(await searchParams);
  const rates = selection
    ? await apiGet<ErpFlightRate[]>(`/erp/flight-rates?${selection.lookup}`, { cache: "no-store" }).catch(() => null)
    : null;
  const flight = selection && Array.isArray(rates) ? rates.find(rate =>
    rate.product_ids.length === selection.products.length &&
    selection.products.every((id, index) => rate.product_ids[index] === id),
  ) : null;

  return (
    <Container className="grid gap-3 py-5 [--container-max:60rem] sm:py-6" dir="rtl">
      <h1 className="text-xl font-black text-brand sm:text-2xl">خرید بلیت پرواز</h1>
      {flight && selection ? (
        <ErpFlightCheckout key={selection.products.join("/")} flight={flight} passengerCounts={selection.counts} resultsHref={resultsHref} />
      ) : (
        <section className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">{selection && rates === null
            ? "دریافت اطلاعات پرواز انجام نشد. صفحه را دوباره بارگیری کنید."
            : "پرواز انتخاب‌شده در دسترس نیست. از نتایج، پرواز دیگری انتخاب کنید."}</p>
          <Link href={resultsHref} className="justify-self-start text-sm font-bold text-brand underline underline-offset-4">بازگشت به نتایج پرواز</Link>
        </section>
      )}
    </Container>
  );
}
