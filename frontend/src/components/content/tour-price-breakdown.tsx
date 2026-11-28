import { formatCurrency } from "@/lib/currency";
import type { TourPriceSummary } from "@/lib/currency-conversion";

export function TourPriceBreakdown({ summary, compact = false }: { summary: TourPriceSummary; compact?: boolean }) {
  if (compact) {
    const amounts = summary.foreign.map(({ amount, currency }) => formatCurrency(amount, currency));
    if (summary.local !== 0 || !amounts.length) amounts.push(formatCurrency(summary.local, "IRT"));
    return (
      <strong className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-brand">
        {amounts.map((amount, index) => (
          <span className="inline-flex items-center gap-1.5" key={index}>
            {index > 0 && <span aria-hidden="true">+</span>}
            <bdi>{amount}</bdi>
          </span>
        ))}
      </strong>
    );
  }

  return (
    <div className="grid min-w-0 gap-1 text-sm text-brand">
      {summary.foreign.length > 0 && (
        <ul aria-label="ریز محاسبه قیمت" className="space-y-1 text-xs leading-6 text-muted">
          {summary.foreign.map(({ currency, amount, rate, toman }) => (
            <li key={currency}>
              <bdi>{formatCurrency(amount, currency)}</bdi>
              {rate === null
                ? " · نرخ تبدیل اعلام نشده است"
                : <> · نرخ هر واحد {formatCurrency(rate, "IRT")} · معادل {formatCurrency(toman, "IRT")}</>}
            </li>
          ))}
          {summary.local !== 0 && <li>بخش تومانی {formatCurrency(summary.local, "IRT")}</li>}
        </ul>
      )}
      <strong>جمع قابل پرداخت: {summary.total === null ? "نیازمند محاسبهٔ نرخ ارز" : formatCurrency(summary.total, "IRT")}</strong>
    </div>
  );
}
