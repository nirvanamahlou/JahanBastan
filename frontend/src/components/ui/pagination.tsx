import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
};

export function Pagination({ currentPage, totalPages, basePath, searchParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null;
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2,
  );
  return (
    <nav aria-label="صفحه‌بندی" className="mt-10 flex max-w-full flex-wrap items-center justify-center gap-2">
      {visiblePages.map((page, index) => {
        const params = new URLSearchParams();
        Object.entries(searchParams).forEach(([key, value]) => { if (value) params.set(key, value); });
        params.set("page", String(page));
        const previous = visiblePages[index - 1];
        return (
          <span className="contents" key={page}>
            {previous && page - previous > 1 ? <span aria-hidden="true" className="px-1 text-muted">…</span> : null}
            <Link href={`${basePath}?${params}`} aria-current={page === currentPage ? "page" : undefined} className={`grid size-11 place-items-center rounded-xl border text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${page === currentPage ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}>{page.toLocaleString("fa-IR")}</Link>
          </span>
        );
      })}
    </nav>
  );
}