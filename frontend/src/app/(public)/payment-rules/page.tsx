import type { Metadata } from "next";
import Link from "next/link";

import { RichText } from "@/components/content/rich-text";
import { Container } from "@/components/ui/container";
import { apiGet } from "@/lib/api/client";
import { defaultPaymentRules } from "@/lib/payment-rules";

export const metadata: Metadata = {
  title: "قوانین پرداخت و استرداد",
  description: "شرایط عمومی پرداخت، لغو و استرداد رزرو هتل، بلیت و تور جهان باستان",
  alternates: { canonical: "/payment-rules/" },
};

export default async function PaymentRulesPage() {
  const settings = await apiGet<{ socialLinks: Record<string, string> }>("/settings", { cache: "no-store" }).catch(() => null);
  const body = settings?.socialLinks.paymentRulesBody?.trim() || defaultPaymentRules;
  return (
    <Container className="py-12 sm:py-16" dir="rtl">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-border bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-black text-brand">قوانین پرداخت و استرداد</h1>
        <div className="mt-8 text-sm leading-8 text-muted sm:text-base"><RichText content={body} /></div>
        <Link className="mt-8 inline-block rounded-xl bg-brand px-5 py-3 font-bold text-white" href="/contact/">تماس با پشتیبانی</Link>
      </article>
    </Container>
  );
}

