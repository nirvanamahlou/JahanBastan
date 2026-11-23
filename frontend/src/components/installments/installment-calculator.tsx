"use client";

import { useMemo, useState } from "react";

import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import { formatCurrency } from "@/lib/currency";

type Props = {
  defaultAmount: number;
  defaultDownPaymentPercent: number;
  minimumDownPaymentPercent: number;
  defaultFeeRate: number;
  maximumFeeRate: number;
  maximumMonths: number;
  expertHref: string;
};

const baseTerms = [3, 6, 9, 12];
const numeric = (value: string, fallback: number) => {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const fa = (value: number) => value.toLocaleString("fa-IR");
const formatDate = (value: string) => value ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value + "T12:00:00")) : "تاریخ انتخاب نشده است";
function addMonths(value: string, months: number) {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

export function InstallmentCalculator({
  defaultAmount,
  defaultDownPaymentPercent,
  minimumDownPaymentPercent,
  defaultFeeRate,
  maximumFeeRate,
  maximumMonths,
  expertHref,
}: Props) {
  const terms = baseTerms.filter((term) => term <= maximumMonths);
  const allowedTerms = terms.length ? terms : [maximumMonths];
  const requiredMinimumDownPaymentPercent = Math.max(50, minimumDownPaymentPercent);
  const [amount, setAmount] = useState(defaultAmount);
  const [downPayment, setDownPayment] = useState(Math.round(defaultAmount * Math.max(requiredMinimumDownPaymentPercent, defaultDownPaymentPercent) / 100));
  const [feeRate, setFeeRate] = useState(Math.min(defaultFeeRate, maximumFeeRate));
  const [months, setMonths] = useState(allowedTerms.includes(6) ? 6 : allowedTerms[allowedTerms.length - 1]);
  const [firstPaymentDate, setFirstPaymentDate] = useState("");

  const result = useMemo(() => {
    const safeAmount = Math.max(0, amount);
    const minimumDownPayment = Math.ceil(safeAmount * requiredMinimumDownPaymentPercent / 100);
    const safeDownPayment = Math.min(safeAmount, Math.max(minimumDownPayment, downPayment));
    const remainingDebt = Math.max(0, safeAmount - safeDownPayment);
    const safeFeeRate = Math.min(maximumFeeRate, Math.max(0, feeRate));
    const installmentFee = Math.round(remainingDebt * months * safeFeeRate / 100);
    const installmentTotal = remainingDebt + installmentFee;
    const monthly = Math.ceil(installmentTotal / months);
    return { minimumDownPayment, safeDownPayment, remainingDebt, safeFeeRate, installmentFee, installmentTotal, monthly, total: safeDownPayment + installmentTotal };
  }, [amount, downPayment, feeRate, maximumFeeRate, requiredMinimumDownPaymentPercent, months]);

  const inputClassName = "mt-2 min-h-12 w-full rounded-xl border border-border bg-white px-3 text-left text-sm font-black text-foreground outline-none transition focus:border-accent-strong focus:ring-4 focus:ring-accent/30";

  return <section aria-labelledby="installment-calculator-title" className="rounded-[2rem] border border-border bg-white p-4 shadow-[0_20px_52px_rgba(1,37,105,0.10)] sm:p-6">
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,.96fr)]" dir="rtl">
      <form className="rounded-3xl bg-brand p-5 text-white shadow-[0_18px_36px_rgba(1,37,105,0.22)] sm:p-6" onSubmit={(event) => event.preventDefault()}>
        <p className="text-sm font-bold text-[#ffd3e7]">اطلاعات سفر و اقساط</p>
        <h2 className="mt-1 text-2xl font-black sm:text-3xl" id="installment-calculator-title">ماشین حساب اقساطی</h2>
        <p className="mt-3 text-sm leading-7 text-white/80">پیش‌پرداخت از مبلغ خرید کسر می‌شود؛ مانده بدهی به همراه کارمزد ماهانه، در تعداد چک‌های انتخابی تقسیم خواهد شد.</p>
        <label className="mt-5 block text-sm font-black">مبلغ کل خرید (تومان)<input className={inputClassName} inputMode="numeric" min="0" onChange={(event) => setAmount(numeric(event.target.value, 0))} type="number" value={amount || ""} /></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-black">پیش‌پرداخت (تومان)<input className={inputClassName} inputMode="numeric" min={result.minimumDownPayment} onChange={(event) => setDownPayment(numeric(event.target.value, 0))} type="number" value={downPayment || ""} /><span className="mt-1 block text-[11px] font-medium text-[#ffd3e7]">حداقل {fa(requiredMinimumDownPaymentPercent)}٪: {formatCurrency(result.minimumDownPayment, "IRT")}</span></label>
          <label className="block text-sm font-black">کارمزد ماهانه (درصد)<input className={inputClassName} inputMode="decimal" max={maximumFeeRate} min="0" onChange={(event) => setFeeRate(numeric(event.target.value, 0))} type="number" value={feeRate} /><span className="mt-1 block text-[11px] font-medium text-[#ffd3e7]">حداکثر قابل انتخاب: {fa(maximumFeeRate)}٪</span></label>
        </div>
        <fieldset className="mt-5"><legend className="text-sm font-black">طرح اقساطی</legend><div className="mt-3 grid grid-cols-4 gap-2">{allowedTerms.map((term) => <button aria-pressed={term === months} className={"min-h-11 rounded-xl border text-sm font-black transition " + (term === months ? "border-accent-strong bg-accent-strong text-white shadow-[0_6px_16px_rgba(235,93,159,0.35)]" : "border-white/30 bg-white/10 text-white hover:bg-white/20")} key={term} onClick={() => setMonths(term)} type="button">{fa(term)} ماهه</button>)}</div></fieldset>
        <label className="mt-5 block text-sm font-black">تاریخ اولین چک<JalaliDateInput ariaLabel="تاریخ اولین چک" className={inputClassName + " text-right"} min={new Date().toISOString().slice(0, 10)} onChange={(value) => setFirstPaymentDate(value ?? "")} value={firstPaymentDate || null} /></label>
        <button className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong px-5 font-black text-white transition hover:bg-[#d94687] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40" type="submit">محاسبه اقساط <span aria-hidden="true">▦</span></button>
      </form>

      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl border border-border"><div className="bg-brand px-4 py-3 text-center text-white"><h3 className="font-black">نتیجه محاسبه</h3></div><div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0"><Metric label="پیش‌پرداخت" value={formatCurrency(result.safeDownPayment, "IRT")} /><Metric label="مبلغ هر چک" value={formatCurrency(result.monthly, "IRT")} /><Metric label="تعداد چک‌ها" value={fa(months) + " فقره"} /><Metric accent label="مبلغ کل قابل پرداخت" value={formatCurrency(result.total, "IRT")} /></div></div>
        <div className="mt-4 rounded-2xl bg-[#fff1f7] px-4 py-3 text-sm leading-7 text-brand"><strong>فرمول محاسبه:</strong> مانده بدهی {formatCurrency(result.remainingDebt, "IRT")} × {fa(months)} ماه × {fa(result.safeFeeRate)}٪ = <strong>{formatCurrency(result.installmentFee, "IRT")}</strong> کارمزد اقساط</div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border"><div className="flex items-center justify-between bg-surface-muted px-4 py-3"><div><h3 className="font-black text-brand">برنامه پرداخت چک‌ها</h3><p className="mt-1 text-xs font-medium text-muted">{firstPaymentDate ? "شروع از " + formatDate(firstPaymentDate) : "تاریخ اولین چک را انتخاب کنید"}</p></div><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">{fa(months)} قسط</span></div><ol className="divide-y divide-border">{Array.from({ length: months }, (_, index) => <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-sm" key={index}><span className="grid size-7 place-items-center rounded-full bg-accent-strong text-xs font-black text-white">{fa(index + 1)}</span><span className="font-bold text-foreground">سررسید {firstPaymentDate ? formatDate(addMonths(firstPaymentDate, index)) : "تاریخ انتخاب نشده"}</span><strong className="text-left text-accent-strong">{formatCurrency(result.monthly, "IRT")}</strong></li>)}</ol></div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted"><span aria-hidden="true">ⓘ</span>مبالغ محاسبه‌شده تقریبی هستند و تأیید نهایی پس از اعتبارسنجی و بررسی کارشناس فروش انجام می‌شود.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-accent-strong bg-white px-4 font-black text-accent-strong transition hover:bg-[#fff1f7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35" onClick={() => window.print()} type="button">دریافت PDF <span aria-hidden="true">▱</span></button><a className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 font-black text-white shadow-[0_8px_18px_rgba(235,93,159,0.26)] transition hover:bg-[#d94687] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35" href={expertHref}>ارسال برای کارشناس <span aria-hidden="true">←</span></a></div>
      </div>
    </div>
  </section>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={"p-4 text-center " + (accent ? "bg-[#fff1f7]" : "bg-white")}><p className="text-xs font-bold text-muted">{label}</p><strong className={"mt-2 block text-sm sm:text-base " + (accent ? "text-accent-strong" : "text-brand")}>{value}</strong></div>;
}
