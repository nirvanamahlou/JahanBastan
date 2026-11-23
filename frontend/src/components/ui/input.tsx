import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import { SiteSelect } from "@/components/ui/site-select";

type FieldFrameProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldFrameProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-xs font-bold text-foreground">
        {label}
        {required ? <span className="mr-1 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={messageId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const controlClassName =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 hover:border-brand/45 focus:border-brand focus:ring-4 focus:ring-accent disabled:cursor-not-allowed disabled:bg-surface-muted";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function Input({
  id,
  label,
  hint,
  error,
  required,
  className = "",
  ...props
}: InputProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        className={`${controlClassName} ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  name?: string;
  onValueChange?: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
  required?: boolean;
  searchable?: boolean;
  value?: string;
};

export function Select({
  id,
  label,
  options,
  hint,
  error,
  placeholder,
  required,
  searchable,
  className = "",
  defaultValue,
  disabled,
  name,
  onValueChange,
  value,
}: SelectProps) {
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <SiteSelect
        ariaLabel={label}
        className={className}
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name={name}
        onValueChange={onValueChange}
        options={placeholder ? [{ label: placeholder, value: "" }, ...options] : options}
        placeholder={placeholder}
        required={required}
        searchable={searchable}
        value={value}
      />
    </FieldFrame>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function Textarea({
  id,
  label,
  hint,
  error,
  required,
  className = "",
  ...props
}: TextareaProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        className={`${controlClassName} min-h-28 resize-y py-2.5 ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}
