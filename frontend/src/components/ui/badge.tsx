import type { HTMLAttributes } from "react";

type BadgeVariant = "brand" | "accent" | "neutral" | "success" | "danger";

const variants: Record<BadgeVariant, string> = {
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent text-accent-foreground",
  neutral: "bg-surface-muted text-muted",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  variant = "neutral",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-bold ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
