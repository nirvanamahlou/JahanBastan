export async function loadAdminOptions<T>(
  loadPage: (offset: number, limit: number) => Promise<Response>,
): Promise<T[]> {
  const items: T[] = [];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const response = await loadPage(offset, limit);
    if (!response.ok) throw new Error(`دریافت فهرست کامل هتل‌ها ناموفق بود (${response.status}).`);
    const page = await response.json() as T[];
    items.push(...page);
    if (page.length < limit) return items;
  }
}
