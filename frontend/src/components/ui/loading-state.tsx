import { TravelLoader } from "@/components/ui/travel-loader";

type LoadingStateProps = {
  label?: string;
  cards?: number;
  className?: string;
};

export function LoadingState({
  label = "در حال بارگذاری",
  cards = 3,
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
      role="status" aria-live="polite" aria-atomic="true"
      aria-label={label}
    >
      <div className="sm:col-span-2 lg:col-span-3">
        <TravelLoader compact label={label} />
      </div>
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className="skeleton-shimmer min-h-48 rounded-2xl border border-border p-6"
          aria-hidden="true"
        >
          <div className="h-4 w-20 rounded-full bg-brand-soft" />
          <div className="mt-7 h-6 w-3/4 rounded-full bg-surface-muted" />
          <div className="mt-4 h-4 w-full rounded-full bg-surface-muted" />
          <div className="mt-2 h-4 w-2/3 rounded-full bg-surface-muted" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
