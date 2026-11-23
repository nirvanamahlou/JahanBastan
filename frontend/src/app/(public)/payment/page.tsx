import type { Metadata } from "next";

import { PaymentRequestForm } from "@/components/payment/payment-request-form";
import { ShieldIcon } from "@/components/layout/site-icons";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "پرداخت آنلاین",
  description: "ثبت امن درخواست پرداخت برای قرارداد سفر.",
};

export default function PaymentPage() {
  return (
    <section className="bg-background py-10 sm:py-16">
      <Container className="grid max-w-5xl gap-4 rounded-3xl border border-border bg-white p-4 shadow-[0_22px_60px_rgba(1,37,105,0.12)] sm:gap-5 sm:p-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.35rem] border border-white/15 bg-[linear-gradient(145deg,#0b3a7d_0%,#012569_100%)] p-7 text-white shadow-[0_16px_36px_rgba(1,37,105,0.18)] sm:p-9">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-white">
            <ShieldIcon className="size-6" />
          </span>
          <h1 className="mt-6 text-2xl font-black sm:text-3xl">پرداخت آنلاین قرارداد</h1>
          <p className="mt-3 max-w-md text-sm leading-7 text-white/80">
            شماره قرارداد و مبلغ را وارد کنید. پس از فعال‌سازی رسمی درگاه، پرداخت با تأیید سرور ثبت می‌شود.
          </p>
          <ul className="mt-8 space-y-3 text-sm leading-6 text-white/85">
            <li>• هیچ اطلاعات کارت بانکی در سایت ذخیره نمی‌شود.</li>
            <li>• کاهش مبلغ قرارداد فقط بعد از تأیید درگاه انجام می‌شود.</li>
            <li>• هر پرداخت با شناسه یکتا ثبت خواهد شد.</li>
          </ul>
        </div>
        <div className="rounded-[1.35rem] border border-border bg-surface-muted/55 p-6 sm:p-8">
          <PaymentRequestForm />
        </div>
      </Container>
    </section>
  );
}