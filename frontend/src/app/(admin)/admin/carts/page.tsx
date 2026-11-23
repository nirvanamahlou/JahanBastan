import { CartManager } from "@/components/admin/cart-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";

export default async function CartsPage() {
  const { user, cookieHeader } = await requireAdmin();
  if (!["super_admin", "admin"].includes(user.role)) return <p>دسترسی مدیریت سبدها ندارید.</p>;
  const response = await adminFetch("/admin/carts", {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  const rows = response.ok ? await response.json() : [];
  return (
    <section className="space-y-6" dir="rtl">
      <header className="rounded-3xl bg-brand p-6 text-white">
        <p className="text-sm text-white/70">فروش و پیگیری</p>
        <h1 className="mt-2 text-3xl font-black">سبدهای خرید و پیگیری فروش</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">سبد فعال، رهاشده و تبدیل‌شده را بدون حذف تاریخچه بررسی کنید؛ تغییر قیمت، زمان آخرین فعالیت و یادداشت پیگیری در یکجا قابل مشاهده است.</p>
      </header>
      <CartManager initial={rows} />
    </section>
  );
}