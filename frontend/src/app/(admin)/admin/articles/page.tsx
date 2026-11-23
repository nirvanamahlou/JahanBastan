import { ArticleManager } from "@/components/admin/editorial-manager";
import { ArticleCategoryManager } from "@/components/admin/article-category-manager";
import { ADMIN_API_BASE_URL, requireAdmin } from "@/lib/admin";
import type { ManagedArticle, ManagedArticleCategory } from "@/types/editorial";

export default async function AdminArticlesPage() {
  const { cookieHeader } = await requireAdmin();
  const [response, categoryResponse] = await Promise.all([
    fetch(`${ADMIN_API_BASE_URL}/admin/articles`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${ADMIN_API_BASE_URL}/admin/article-categories`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
  ]);
  const items = response.ok ? (await response.json()) as ManagedArticle[] : [];
  const categories = categoryResponse.ok ? (await categoryResponse.json()) as ManagedArticleCategory[] : [];
  return <div className="space-y-6"><header><p className="text-sm font-bold text-brand">مدیریت محتوا</p><h1 className="mt-2 text-3xl font-black">مقالات</h1><p className="mt-2 text-muted">ایجاد، ویرایش، انتشار و مدیریت SEO مقاله‌ها.</p></header><ArticleCategoryManager initialItems={categories} /><ArticleManager categories={categories} initialItems={items} /></div>;
}
