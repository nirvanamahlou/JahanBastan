import type { HTMLAttributes } from "react";

type CardVariant = "default" | "soft" | "outlined";

const variants: Record<CardVariant, string> = {
  default:
    "border-border/80 bg-surface shadow-[0_16px_44px_rgba(1,37,105,0.09)]",
  soft: "border-accent bg-surface-muted",
  outlined: "border-border bg-transparent",
};

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
  variant?: CardVariant;
};

export function Card({
  as: Element = "div",
  variant = "default",
  className = "",
  ...props
}: CardProps) {
  return (
    <Element
      className={`site-card rounded-xl border p-3.5 sm:p-4 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
