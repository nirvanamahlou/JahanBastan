import { redirect } from "next/navigation";

import { VisaApplicationManager } from "@/components/admin/visa-application-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";

export default async function VisaApplicationsPage() {
  const { user, cookieHeader } = await requireAdmin();
  if (user.role === "editor") redirect("/admin/");
  const response = await adminFetch("/admin/visa-applications", { headers: { cookie: cookieHeader }, cache: "no-store" });
  const items = response.ok ? await response.json() : [];
  return <section className="space-y-6" dir="rtl"><header className="rounded-3xl bg-brand p-6 text-white sm:p-8"><p className="text-sm text-white/70">مدارک خصوصی مشتریان</p><h1 className="mt-2 text-3xl font-black">درخواست‌های ویزا</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">کارشناس وضعیت پرونده، پیام قابل مشاهده برای مسافر و یادداشت خصوصی را مدیریت می‌کند.</p></header><VisaApplicationManager initialItems={items} /></section>;
}
