export function PublicPageSkeleton() {
  return (
    <div className="app-page-loading" role="status">
      <span className="app-page-loading__indicator" aria-hidden="true" />
      <span>در حال بارگذاری…</span>
    </div>
  );
}
