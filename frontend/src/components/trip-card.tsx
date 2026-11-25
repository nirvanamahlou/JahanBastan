import type { ReactNode } from "react";

type TripCardProps = {
  title: string;
  subtitle?: string;
  status: string;
  amount: string;
  contractNumber?: string | null;
  facts: { label: string; value: string }[];
  children?: ReactNode;
};

export function TripCard({ title, subtitle, status, amount, contractNumber, facts, children }: TripCardProps) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-brand/15 bg-white shadow-md">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-s-4 border-brand bg-gradient-to-l from-brand-soft via-white to-white p-4 text-brand focus-visible:outline-2 focus-visible:outline-offset-[-3px] sm:p-5">
        <span className="grid min-w-0 gap-2">
          <strong className="break-words text-xl">{title}</strong>
          {subtitle && <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
            {subtitle.split(" · ").map((part, i) => <bdi key={i}>{part}</bdi>)}
          </span>}
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="rounded-full border border-brand/15 bg-white px-3 py-1 text-xs font-bold">{status}</span>
            <bdi className="text-sm font-bold">{amount}</bdi>
          </span>
        </span>
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-white shadow-sm transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="grid gap-4 border-t border-border p-4 sm:p-5">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-brand/15 bg-brand-soft p-3">
            <dt className="text-xs text-muted">شماره قرارداد آوینا</dt>
            <dd className="mt-1 font-black text-brand">{contractNumber ? <bdi>{contractNumber}</bdi> : "ثبت نشده"}</dd>
          </div>
          {facts.map(({ label, value }) => (
            <div key={label} className="min-w-0 rounded-xl border border-border bg-surface-muted p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 break-words text-sm font-bold text-brand">{value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </div>
    </details>
  );
}
