import { FAQManager } from "@/components/admin/editorial-manager";
import { ADMIN_API_BASE_URL, requireAdmin } from "@/lib/admin";
import type { ManagedFAQ } from "@/types/editorial";

export default async function AdminFAQPage() {
  const { cookieHeader } = await requireAdmin();
  const response = await fetch(`${ADMIN_API_BASE_URL}/admin/faqs`, { headers: { cookie: cookieHeader }, cache: "no-store" });
  const items = response.ok ? (await response.json()) as ManagedFAQ[] : [];
  return <div className="space-y-6"><header><p className="text-sm font-bold text-brand">پشتیبانی محتوا</p><h1 className="mt-2 text-3xl font-black">سوالات متداول</h1><p className="mt-2 text-muted">دسته‌بندی، ترتیب و وضعیت انتشار پاسخ‌ها.</p></header><FAQManager initialItems={items} /></div>;
}
