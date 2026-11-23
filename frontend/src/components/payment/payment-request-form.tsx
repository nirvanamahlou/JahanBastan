"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type PaymentConfiguration = {
  enabled: boolean;
  provider?: string;
  message: string;
};

type PaymentIntent = {
  id: number;
  status: string;
  checkoutUrl?: string | null;
};

const currencies = [
  { value: "IRR", label: "ریال ایران (IRR)" },
  { value: "IRT", label: "تومان ایران (IRT)" },
  { value: "USD", label: "دلار آمریکا (USD)" },
  { value: "EUR", label: "یورو (EUR)" },
  { value: "TRY", label: "لیر ترکیه (TRY)" },
  { value: "GEL", label: "لاری گرجستان (GEL)" },
] as const;

export function PaymentRequestForm() {
  const searchParams = useSearchParams();
  const [configuration, setConfiguration] = useState<PaymentConfiguration | null>(null);
  const [contractNumber, setContractNumber] = useState(() => searchParams.get("contract") ?? "");
  const [amount] = useState(() => {
    const value = searchParams.get("amount");
    return value && /^\d+$/.test(value) ? value : "";
  });
  const [currency] = useState(() => {
    const value = searchParams.get("currency");
    return value && currencies.some((item) => item.value === value) ? value : "IRT";
  });
  const [notice, setNotice] = useState(() => {
    const status = searchParams.get("status");
    if (status === "paid") return "پرداخت با موفقیت تأیید شد.";
    if (status === "received") return "پرداخت ثبت شد و پس از تأیید پشتیبان، بلیت‌ها صادر می‌شوند.";
    if (status === "pending") return "نتیجه پرداخت هنوز در حال بررسی است.";
    if (status === "cancelled") return "پرداخت لغو شد و مبلغی ثبت نشد.";
    if (status === "failed") return "پرداخت تأیید نشد؛ در صورت کسر وجه با پشتیبانی تماس بگیرید.";
    return "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch(`${PUBLIC_API_BASE_URL}/payments/configuration`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as PaymentConfiguration;
      })
      .then((value) => {
        if (isMounted) setConfiguration(value);
      })
      .catch(() => {
        if (isMounted) {
          setConfiguration({
            enabled: false,
            message: "وضعیت پرداخت آنلاین در دسترس نیست.",
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!configuration?.enabled) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/payments/intents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crmContractNumber: contractNumber.trim(),
          amount: Number(amount),
          currency,
        }),
      });
      const body = (await response.json().catch(() => null)) as PaymentIntent | { detail?: string } | null;
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("برای پرداخت ابتدا وارد حساب کاربری خود شوید.");
        }
        throw new Error(body && "detail" in body && body.detail ? body.detail : "ایجاد درخواست پرداخت ناموفق بود.");
      }
      if (body && "checkoutUrl" in body && body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
        return;
      }
      setNotice("درخواست پرداخت ثبت شد؛ درگاه هنوز برای هدایت فعال نشده است.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "خطای غیرمنتظره رخ داد.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDisabled = !configuration?.enabled;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className={`rounded-2xl border p-4 text-sm leading-7 ${isDisabled ? "border-amber-200 bg-amber-50 text-amber-900" : "border-brand/15 bg-brand/5 text-brand"}`}>
        {configuration?.message ?? "در حال بررسی وضعیت پرداخت آنلاین…"}
      </div>

      <label className="block text-sm font-bold text-brand">
        شماره قرارداد
        <input
          value={contractNumber}
          onChange={(event) => setContractNumber(event.target.value)}
          required
          minLength={2}
          maxLength={128}
          placeholder="مثال: CNT-1405-00125"
          className="mt-2 min-h-12 w-full rounded-xl border border-border bg-white px-4 text-left text-sm text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
          dir="ltr"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
        <label className="block text-sm font-bold text-brand">
          مبلغ پرداخت
          <input
            value={amount}
            readOnly
            inputMode="numeric"
            required
            min="1"
            placeholder="0"
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-white px-4 text-left text-sm text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            dir="ltr"
          />
        </label>
        <label className="block text-sm font-bold text-brand">
          ارز
          <select
            value={currency}
            disabled
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
          >
            {currencies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      {notice ? <p role="status" aria-live="polite" aria-atomic="true" className="rounded-xl bg-surface-muted p-3 text-sm font-medium text-muted">{notice}</p> : null}

      <button
        type="submit"
        disabled={isDisabled || isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--interaction-hover)] px-5 font-bold text-white shadow-[0_10px_22px_rgba(199,33,105,0.24)] transition hover:bg-[var(--interaction-hover-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "در حال ایجاد درخواست…" : "ادامه به پرداخت امن"}
      </button>
      <p className="text-xs leading-6 text-muted">مبلغ و ارز از فاکتور تأییدشده خوانده می‌شوند و قابل تغییر نیستند. اطلاعات کارت بانکی در این سایت ذخیره یا دریافت نمی‌شود. مبلغ نهایی فقط پس از تأیید درگاه ثبت خواهد شد.</p>
    </form>
  );
}