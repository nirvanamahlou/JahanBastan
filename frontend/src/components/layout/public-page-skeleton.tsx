export function PublicPageSkeleton() {
  return <section className="app-page-skeleton" role="status" aria-label="در حال آماده‌سازی صفحه">
    <span className="sr-only">در حال دریافت اطلاعات تازه سفر…</span>
    <div className="app-page-skeleton__hero" aria-hidden="true"><span /><span /></div>
    <div className="app-page-skeleton__search" aria-hidden="true"><span /><span /><span /></div>
    <div className="app-page-skeleton__cards" aria-hidden="true"><span /><span /></div>
  </section>;
}
