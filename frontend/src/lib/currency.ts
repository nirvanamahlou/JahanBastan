export type CurrencyOption = {
  code: string;
  label: string;
  symbol: string;
};

export const CURRENCY_OPTIONS: readonly CurrencyOption[] = [
  { code: "IRT", label: "تومان ایران", symbol: "تومان" },
  { code: "USD", label: "دلار آمریکا", symbol: "$" },
  { code: "EUR", label: "یورو", symbol: "€" },
  { code: "TRY", label: "لیر ترکیه", symbol: "₺" },
  { code: "GEL", label: "لاری گرجستان", symbol: "₾" },
  { code: "IRR", label: "ریال ایران", symbol: "﷼" },
] as const;

export function currencyOptionText(option: CurrencyOption) {
  return `${option.symbol} · ${option.label} (${option.code})`;
}

export function currencyLabel(code: string | null | undefined) {
  if (!code) return "";
  const normalized = code.toUpperCase();
  const option = CURRENCY_OPTIONS.find((item) => item.code === normalized);
  return option ? `${option.symbol} · ${option.label}` : code;
}

export function roundForeignCurrencyUp(
  value: number,
  code: string | null | undefined,
) {
  const normalized = (code || "IRT").toUpperCase();
  return normalized === "USD" || normalized === "EUR" ? Math.ceil(value) : value;
}

export function formatCurrency(
  value: string | number | null | undefined,
  code: string | null | undefined,
) {
  if (value === null || value === undefined || value === "") return "";
  const numericValue = Number(value);
  const normalized = (code || "IRT").toUpperCase();
  const shouldRoundUp = normalized === "USD" || normalized === "EUR";
  const shownValue = Number.isFinite(numericValue)
    ? roundForeignCurrencyUp(numericValue, normalized)
    : numericValue;
  const amount = Number.isFinite(shownValue)
    ? shownValue.toLocaleString(
        "fa-IR",
        shouldRoundUp ? { maximumFractionDigits: 0 } : undefined,
      )
    : String(value);
  const option = CURRENCY_OPTIONS.find((item) => item.code === normalized);
  if (!option) return `${amount} ${code || ""}`.trim();
  if (normalized === "IRT") return `${amount} تومان`;
  if (normalized === "IRR") return `${amount} ریال`;
  return `${option.symbol} ${amount}`;
}
