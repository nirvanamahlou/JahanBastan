type CatalogPage<T> = {
  items: T[];
  limit: number;
  offset: number;
  total: number;
};

export async function loadAllPages<T>(
  loadPage: (offset: number, limit: number) => Promise<CatalogPage<T>>,
  limit = 100,
) {
  const firstPage = await loadPage(0, limit);
  const pageSize = firstPage.limit || limit;
  const remainingOffsets = Array.from(
    { length: Math.max(0, Math.ceil(firstPage.total / pageSize) - 1) },
    (_, index) => (index + 1) * pageSize,
  );
  const remainingPages = await Promise.all(
    remainingOffsets.map((offset) => loadPage(offset, pageSize)),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}
