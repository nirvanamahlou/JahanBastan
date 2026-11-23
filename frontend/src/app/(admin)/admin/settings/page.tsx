import { SettingsForm } from "@/components/admin/settings-form";
import { NoraConnector } from "@/components/admin/nora-connector";
import { ADMIN_API_BASE_URL, requireAdmin } from "@/lib/admin";
import type { ManagedSiteSettings } from "@/types/editorial";

const fallback: ManagedSiteSettings = {
  id: 1,
  siteName: "جهان باستان",
  phone: "۰۲۱ ۷۲۰۷ ۵۰۰۰",
  email: null,
  address: "تهران، محله کاووسیه، بلوار میرداماد، بعد از نلسون ماندلا، پلاک ۳۸۴",
  workingHours: "شنبه تا چهارشنبه، ۹ تا ۱۹",
  socialLinks: {},
  internalNote: null,
  updatedAt: new Date(0).toISOString(),
};

export default async function AdminSettingsPage() {
  const { cookieHeader, user } = await requireAdmin();
  const response = await fetch(`${ADMIN_API_BASE_URL}/admin/settings`, { headers: { cookie: cookieHeader }, cache: "no-store" });
  const settings = response.ok ? (await response.json()) as ManagedSiteSettings : fallback;
  return <div className="space-y-6"><header><p className="text-sm font-bold text-brand">پیکربندی سایت</p><h1 className="mt-2 text-3xl font-black">تنظیمات عمومی</h1><p className="mt-2 text-muted">اطلاعات تماس، ساعات کاری، محتوای فوتر، لینک‌ها و شبکه‌های اجتماعی.</p></header><SettingsForm initialSettings={settings} />{["admin", "super_admin"].includes(user.role) ? <NoraConnector /> : null}</div>;
}
