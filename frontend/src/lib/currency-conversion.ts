import { roundForeignCurrencyUp } from "@/lib/currency";

export type ExchangeRates = {
  usdToIrt?: string | number | null;
  eurToIrt?: string | number | null;
};

export function toToman(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  rates: ExchangeRates,
) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const code = (currency || "IRT").toUpperCase();
  if (code === "IRT" || code === "TOMAN") return amount;
  if (code === "IRR") return Math.round(amount / 10);
  const rate = code === "USD" ? Number(rates.usdToIrt) : code === "EUR" ? Number(rates.eurToIrt) : 0;
  return Number.isFinite(rate) && rate > 0
    ? Math.ceil(roundForeignCurrencyUp(amount, code) * rate)
    : null;
}
