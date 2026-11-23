"use client";

import { useEffect, useState } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type PaymentConfiguration = {
  enabled: boolean;
  message: string;
};

type WalletTopUpResponse = {
  checkoutUrl: string | null;
};

function normalizeAmount(value: string): number {
  const latinDigits = value.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
  return Number(latinDigits.replace(/[٬,\s]/g, ""));
}

export function WalletTopUpPanel() {
  const [amount, setAmount] = useState("1000000");
  const [configuration, setConfiguration] = useState<PaymentConfiguration | null>(null);
  const [loadingConfiguration, setLoadingConfiguration] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const numericAmount = normalizeAmount(amount);

  useEffect(() => {
    let active = true;
    void fetch(`${PUBLIC_API_BASE_URL}/payments/configuration`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) =>
        response.ok ? await response.json() as PaymentConfiguration : null,
      )
      .catch(() => null)
      .then((value) => {
        if (!active) return;
        setConfiguration(value);
        setLoadingConfiguration(false);
      });

    const timer = window.setTimeout(() => {
      const state = new URLSearchParams(window.location.search).get("topup");
      if (state === "success") setMessage("پرداخت تأیید شد و موجودی کیف پول شما افزایش یافت.");
      else if (state === "cancelled") setMessage("شارژ کیف پول لغو شد؛ مبلغی به موجودی شما اضافه نشد.");
      else if (state === "failed") setMessage("تأیید پرداخت ناموفق بود؛ مبلغی به موجودی شما اضافه نشد.");
      else if (state === "pending") setMessage("درگاه هنوز نتیجه پرداخت را تأیید نکرده است. چند دقیقه دیگر دوباره بررسی کنید.");
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  async function startTopUp() {
    if (!Number.isInteger(numericAmount) || numericAmount < 10_000 || numericAmount > 500_000_000) {
      setMessage("مبلغ شارژ باید بین ۱۰٬۰۰۰ تا ۵۰۰٬۰۰۰٬۰۰۰ ریال باشد.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    const response = await fetch(`${PUBLIC_API_BASE_URL}/payments/wallet-topups`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: numericAmount, currency: "IRR" }),
    }).catch(() => null);

    if (!response?.ok) {
      setSubmitting(false);
      setMessage(
        response?.status === 409
          ? "یک درخواست شارژ در انتظار پرداخت دارید. ابتدا همان پرداخت را تکمیل یا لغو کنید."
          : "ایجاد درخواست پرداخت ناموفق بود. اتصال درگاه را دوباره بررسی کنید.",
      );
      return;
    }

    const payload = await response.json() as WalletTopUpResponse;
    if (!payload.checkoutUrl) {
      setSubmitting(false);
      setMessage("نشانی امن درگاه پرداخت دریافت نشد. دوباره تلاش کنید.");
      return;
    }
    window.location.assign(payload.checkoutUrl);
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-brand">افزایش موجودی</h2>
          <p className="mt-1 text-sm leading-7 text-muted">
            مبلغ را به ریال وارد کنید؛ پس از تأیید امن پرداخت، همان مبلغ به کیف پولتان اضافه می‌شود.
          </p>
        </div>
        <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-pink-600">پرداخت امن</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1.5 text-sm font-bold text-brand">
          <span>مبلغ شارژ (ریال)</span>
          <input
            className="min-h-12 rounded-xl border border-border bg-white px-3 text-base font-black text-brand outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            dir="ltr"
            inputMode="numeric"
            min="10000"
            onChange={(event) => setAmount(event.target.value)}
            value={amount}
          />
        </label>
        <button
          className="mt-auto min-h-12 rounded-xl bg-pink-500 px-6 text-sm font-black text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loadingConfiguration || !configuration?.enabled || submitting}
          onClick={() => void startTopUp()}
          type="button"
        >
          {submitting ? "در حال انتقال…" : "افزایش موجودی و پرداخت"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[500000, 1000000, 2000000, 5000000].map((value) => (
          <button
            className="rounded-lg border border-pink-200 px-3 py-2 text-xs font-bold text-pink-600 transition hover:bg-pink-50"
            key={value}
            onClick={() => setAmount(String(value))}
            type="button"
          >
            {new Intl.NumberFormat("fa-IR").format(value)} ریال
          </button>
        ))}
      </div>
      {loadingConfiguration ? <p className="mt-4 text-sm text-muted">در حال بررسی اتصال امن درگاه پرداخت…</p> : null}
      {!loadingConfiguration && !configuration?.enabled ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
          {configuration?.message || "امکان اتصال به درگاه پرداخت فراهم نیست."}
        </p>
      ) : null}
      {message ? <p aria-live="polite" className="mt-4 rounded-xl bg-brand/10 px-3 py-2 text-sm font-bold text-brand">{message}</p> : null}
    </section>
  );
}

