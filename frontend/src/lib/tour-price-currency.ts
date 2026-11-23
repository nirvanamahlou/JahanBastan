/** Local child rates are final workbook amounts, never hotel-plus-flight rates. */
export function isFinalLocalTourPrice(currency: string | null | undefined) {
  return ["IRT", "IRR", "RIAL", "TOMAN", "TMN"].includes((currency ?? "IRT").trim().toUpperCase());
}
