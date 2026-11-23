import { LoadingSettingsForm } from "@/components/admin/loading-settings-form";
import { ADMIN_API_BASE_URL, requireAdmin } from "@/lib/admin";
import type { ManagedSiteSettings } from "@/types/editorial";

const fallback: ManagedSiteSettings = { id: 1, siteName: "جهان باستان", phone: null, email: null, address: null, workingHours: null, socialLinks: {}, internalNote: null, updatedAt: new Date(0).toISOString() };

export default async function AdminLoadingPage() {
  const { cookieHeader } = await requireAdmin();
  const response = await fetch(ADMIN_API_BASE_URL + "/admin/settings", { headers: { cookie: cookieHeader }, cache: "no-store" });
  const settings = response.ok ? await response.json() as ManagedSiteSettings : fallback;
  return <section className="space-y-6" dir="rtl"><header><p className="text-sm font-bold text-brand">ظاهر سایت</p><h1 className="mt-2 text-3xl font-black">مدیریت صفحه لودینگ</h1><p className="mt-2 max-w-3xl leading-7 text-muted">متن فارسی و تصاویر لودر اولیه‌ی صفحات عمومی را از اینجا انتخاب و ذخیره کنید.</p></header><LoadingSettingsForm initialSettings={settings} /></section>;
}
