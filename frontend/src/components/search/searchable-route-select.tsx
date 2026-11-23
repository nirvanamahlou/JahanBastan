"use client";

import { SiteSelect } from "@/components/ui/site-select";

export type RouteSelectOption = {
  description?: string;
  label: string;
  value: string;
};

export function SearchableRouteSelect({
  className = "",
  defaultValue = "",
  disabled = false,
  id,
  label,
  name,
  onValueChange,
  options,
  placeholder,
  required = false,
  value,
}: {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onValueChange?: (value: string) => void;
  options: ReadonlyArray<RouteSelectOption>;
  placeholder: string;
  required?: boolean;
  value?: string;
}) {
  const selectOptions = required
    ? options
    : [{ label: placeholder, value: "" }, ...options];

  return (
    <div className="grid min-w-0 gap-1">
      <label className="text-xs font-bold" htmlFor={id}>
        {label}
        {required ? <span className="mr-1 text-danger">*</span> : null}
      </label>
      <SiteSelect
        ariaLabel={label}
        className={className}
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name={name}
        onValueChange={onValueChange}
        options={selectOptions}
        placeholder={placeholder}
        required={required}
        searchable
        value={value}
      />
    </div>
  );
}
