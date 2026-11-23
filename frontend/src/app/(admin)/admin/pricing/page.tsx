import { BulkPricingManagerV2 } from "@/components/admin/bulk-pricing-manager-v2";
import { ExchangeRateManager } from "@/components/admin/exchange-rate-manager";
import { requireAdmin } from "@/lib/admin";

export default async function AdminPricingPage() {
  const { user } = await requireAdmin();

  if (user.role !== "super_admin" && !((user.role === "admin" || user.role === "editor") && user.canManagePricing)) {
    return (
      <section className="rounded-3xl border border-red-200 bg-white p-8" dir="rtl">
        <h1 className="text-2xl font-black text-red-800">دسترسی محدود</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          برای مدیریت نرخ‌ها باید مدیر ارشد باشید یا دسترسی مدیریت نرخ‌ها برای حساب شما فعال شده باشد.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6" dir="rtl">
      <header className="rounded-3xl bg-brand p-6 text-white">
        <p className="text-sm text-white/70">قیمت‌گذاری و فروش</p>
        <h1 className="mt-2 text-3xl font-black">نرخ ارز و مدیریت قیمت‌ها</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
          نرخ ارز را برای سفارش‌های آینده ثبت کنید و قیمت تور، هتل یا بلیط را
          به‌صورت درصدی یا مبلغ ثابت، پس از پیش‌نمایش و تأیید تغییر دهید.
        </p>
      </header>
      <ExchangeRateManager />
      <BulkPricingManagerV2 />
    </section>
  );
}
