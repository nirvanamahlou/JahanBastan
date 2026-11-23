export function TourCardSkeleton() {
  return (
    <div
      className="h-full animate-pulse overflow-hidden rounded-2xl border border-border bg-surface"
      aria-hidden="true"
    >
      <div className="aspect-square bg-brand-soft" />
      <div className="p-5 sm:p-6">
        <div className="h-7 w-3/4 rounded-full bg-surface-muted" />
        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-border py-4">
          <div className="h-10 rounded-xl bg-surface-muted" />
          <div className="h-10 rounded-xl bg-surface-muted" />
        </div>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="h-10 w-28 rounded-xl bg-surface-muted" />
          <div className="h-5 w-20 rounded-full bg-brand-soft" />
        </div>
      </div>
    </div>
  );
}
