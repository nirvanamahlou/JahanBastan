import type { SelectHTMLAttributes } from "react";

import { CURRENCY_OPTIONS, currencyOptionText } from "@/lib/currency";

type CurrencySelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  label?: string;
};

export function CurrencySelect({
  label,
  className,
  ...props
}: CurrencySelectProps) {
  const selectedValue = String(props.value ?? props.defaultValue ?? "");
  const hasLegacyValue = Boolean(
    selectedValue &&
      !CURRENCY_OPTIONS.some((option) => option.code === selectedValue),
  );
  const select = (
    <select className={className} {...props}>
      {hasLegacyValue ? (
        <option value={selectedValue}>{selectedValue}</option>
      ) : null}
      {CURRENCY_OPTIONS.map((option) => (
        <option key={option.code} value={option.code}>
          {currencyOptionText(option)}
        </option>
      ))}
    </select>
  );

  if (!label) return select;

  return (
    <label className="space-y-1 text-xs font-bold">
      <span className="block">{label}</span>
      {select}
    </label>
  );
}