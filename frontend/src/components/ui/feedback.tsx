"use client";

import { type ReactNode, useEffect } from "react";

type AlertVariant = "info" | "success" | "error" | "warning";

const alertStyles: Record<AlertVariant, string> = {
  info: "border-brand/25 bg-brand-soft text-brand",
  success: "border-success/25 bg-success/10 text-success",
  error: "border-danger/25 bg-danger/10 text-danger",
  warning: "border-accent-strong bg-surface-muted text-foreground",
};

export function Alert({ children, variant = "info", title }: { children: ReactNode; variant?: AlertVariant; title?: string }) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm ${alertStyles[variant]}`}>
      {title ? <p className="font-black">{title}</p> : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function ValidationSummary({ errors }: { errors: ReadonlyArray<string> }) {
  if (!errors.length) return null;
  return (
    <Alert variant="error" title="لطفاً خطاهای زیر را اصلاح کنید">
      <ul className="list-inside list-disc">
        {errors.map((error) => <li key={error}>{error}</li>)}
      </ul>
    </Alert>
  );
}

export function Toast({ message, onDismiss, duration = 4000 }: { message: string; onDismiss: () => void; duration?: number }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-4 left-4 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-xl">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="بستن اعلان">×</button>
    </div>
  );
}
