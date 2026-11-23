import { CustomerListManager, type Customer } from "@/components/admin/customer-list-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";

interface CustomerListResponse {
  items: Customer[];
  total: number;
  limit: number;
  offset: number;
}

export default async function CustomersPage() {
  const { user, cookieHeader } = await requireAdmin();
  if (user.role !== "super_admin") return <p>دسترسی به فهرست مشتریان ندارید.</p>;

  const response = await adminFetch("/admin/customers?pageSize=100", {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  const customers = response.ok
    ? (await response.json()) as CustomerListResponse
    : { items: [], total: 0, limit: 100, offset: 0 };

  return (
    <section className="space-y-6" dir="rtl">
      <header className="rounded-3xl bg-brand p-6 text-white sm:p-8">
        <p className="text-sm text-white/70">مدیریت حساب مشتریان</p>
        <h1 className="mt-2 text-3xl font-black">کاربران ثبت‌نام‌شده سایت</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">فقط اطلاعات لازم برای پشتیبانی و مدیریت حساب نمایش داده می‌شود؛ رمز عبور و اطلاعات بانکی کاربران در این بخش قابل مشاهده نیست.</p>
      </header>
      <CustomerListManager initial={customers.items} initialTotal={customers.total} />
    </section>
  );
}
