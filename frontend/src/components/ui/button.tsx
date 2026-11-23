import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-[0_8px_20px_rgba(1,37,105,0.16)] hover:-translate-y-0.5 hover:bg-brand-strong",
  accent:
    "bg-accent-strong text-brand shadow-[0_8px_20px_rgba(233,77,152,0.2)] hover:-translate-y-0.5 hover:bg-accent",
  secondary:
    "border border-border bg-surface text-brand hover:border-brand hover:bg-brand-soft",
  ghost: "bg-transparent text-brand hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 text-xs",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-11 px-5 text-sm",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `site-button inline-flex items-center justify-center gap-1.5 rounded-lg font-bold transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-l-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
