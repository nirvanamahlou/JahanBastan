"use client";

import { type FormEvent, useEffect, useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";

type Rate = { code: "USD" | "EUR"; rateToman: string; updatedAt: string; updatedByName: string | null };

const labels = { USD: "هر یک دلار آمریکا", EUR: "هر یک یورو" } as const;

export function ExchangeRateManager() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminClientFetch("/admin/pricing/exchange-rates", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail ?? "دریافت نرخ‌ها ناموفق بود.");
        if (active) setRates(payload ?? []);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "دریافت نرخ‌ها ناموفق بود."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>, code: "USD" | "EUR") {
    event.preventDefault();
    setSaving(code); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    const rateToman = Number(form.get("rateToman"));
    const response = await adminClientFetch(`/admin/pricing/exchange-rates/${code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateToman }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (response?.ok && payload) {
      setRates((current) => [...current.filter((item) => item.code !== code), payload].sort((a, b) => a.code.localeCompare(b.code)));
      setMessage(`نرخ ${code === "USD" ? "دلار" : "یورو"} ذخیره شد و فقط برای سفارش‌های آینده استفاده می‌شود.`);
    } else {
      setError(payload?.detail ?? "ذخیره نرخ ناموفق بود.");
    }
    setSaving(null);
  }

  return <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7" aria-labelledby="exchange-rate-title">
    <h2 className="text-xl font-black text-brand" id="exchange-rate-title">نرخ دستی دلار و یورو به تومان</h2>
    <p className="mt-2 text-sm leading-7 text-muted">مبلغ یک واحد ارز را به تومان وارد کنید. نرخ هر سفارش هنگام ثبت، روی همان سفارش ذخیره می‌شود و تغییرات بعدی روی سفارش‌های قبلی اثر ندارد.</p>
    {loading ? <p className="mt-5 rounded-xl bg-surface-muted p-4 text-sm text-muted" role="status">در حال دریافت نرخ‌ها…</p> : <div className="mt-5 grid gap-4 lg:grid-cols-2">{(["USD", "EUR"] as const).map((code) => {
      const rate = rates.find((item) => item.code === code);
      return <form className="rounded-2xl border border-border p-4" key={`${code}-${rate?.updatedAt ?? "new"}`} onSubmit={(event) => void save(event, code)}>
        <div className="flex items-center justify-between gap-3"><div><strong className="block text-brand">{labels[code]}</strong><span className="text-xs text-muted">{code}</span></div>{rate?.updatedAt ? <time className="text-xs text-muted" dateTime={rate.updatedAt}>آخرین ویرایش: {new Date(rate.updatedAt).toLocaleString("fa-IR")}</time> : null}</div>
        <label className="mt-4 grid gap-2 text-sm font-bold" htmlFor={`rate-${code}`}><span>نرخ به تومان</span><input className="min-h-12 rounded-xl border border-border px-4" defaultValue={rate?.rateToman ?? ""} dir="ltr" id={`rate-${code}`} min="1" name="rateToman" required step="1" type="number" /></label>
        <button className="mt-4 min-h-11 w-full rounded-xl bg-brand font-black text-white disabled:opacity-50" disabled={saving !== null} type="submit">{saving === code ? "در حال ذخیره…" : `ذخیره نرخ ${code === "USD" ? "دلار" : "یورو"}`}</button>
      </form>;
    })}</div>}
    {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">{message}</p> : null}
    {error ? <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800" role="alert">{error}</p> : null}
    <p className="mt-4 text-xs leading-6 text-muted">نرخ‌های جدید فقط برای محاسبات و فاکتورهای آینده هستند؛ مبالغ و snapshot سفارش‌های صادرشده تغییر نمی‌کنند.</p>
  </section>;
}