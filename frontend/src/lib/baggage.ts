const BAGGAGE_UNIT_PATTERN = /(?:کیلو(?:گرم)?|kg|kilo)/iu;

export function formatBaggageAllowance(value: string | null | undefined): string {
  const allowance = value?.trim();

  if (!allowance) {
    return "بار مجاز اعلام می‌شود";
  }

  return BAGGAGE_UNIT_PATTERN.test(allowance)
    ? allowance
    : `${allowance} کیلوگرم`;
}