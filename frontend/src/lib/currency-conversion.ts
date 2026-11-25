import { roundForeignCurrencyUp } from "@/lib/currency";

export type ExchangeRates = {
  usdToIrt?: string | number | null;
  eurToIrt?: string | number | null;
};

function foreignRate(code: string, rates: ExchangeRates) {
  const rate = code === "USD" ? Number(rates.usdToIrt) : code === "EUR" ? Number(rates.eurToIrt) : 0;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

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
  const rate = foreignRate(code, rates);
  return rate !== null
    ? Math.ceil(roundForeignCurrencyUp(amount, code) * rate)
    : null;
}

type PricePart = {
  amount: string | number | null | undefined;
  currency: string | null | undefined;
  quantity: number;
};

export function summarizeTourPrice(parts: PricePart[], rates: ExchangeRates) {
  const foreign = new Map<string, { currency: string; amount: number; rate: number | null; toman: number }>();
  let local = 0;
  let total: number | null = 0;
  for (const { amount, currency, quantity } of parts) {
    if (!quantity) continue;
    const code = (currency || "IRT").toUpperCase();
    const unitToman = toToman(amount, code, rates);
    if (unitToman === null) total = null;
    const toman = (unitToman ?? 0) * quantity;
    if (total !== null) total += toman;
    if (code === "IRT" || code === "TOMAN" || code === "IRR") {
      local += toman;
    } else {
      const row = foreign.get(code) ?? { currency: code, amount: 0, rate: foreignRate(code, rates), toman: 0 };
      row.amount += roundForeignCurrencyUp(Number(amount), code) * quantity;
      row.toman += toman;
      foreign.set(code, row);
    }
  }
  return { local, foreign: Array.from(foreign.values()), total };
}

export type TourPriceSummary = ReturnType<typeof summarizeTourPrice>;
