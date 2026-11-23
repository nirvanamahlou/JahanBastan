import { AgencyManager, type Agency } from "@/components/admin/agency-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";

export default async function AgenciesPage() {
  const { user, cookieHeader } = await requireAdmin();
  if (!(["super_admin", "admin"] as string[]).includes(user.role)) {
    return <p>دسترسی بررسی حساب‌های آژانسی را ندارید.</p>;
  }
  const response = await adminFetch("/admin/agencies", {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  const agencies = response.ok ? (await response.json()) as Agency[] : [];

  return (
    <section className="space-y-6" dir="rtl">
      <header className="rounded-3xl bg-brand p-6 text-white sm:p-8">
        <p className="text-sm text-white/70">بررسی مدارک و کنترل اعتبار</p>
        <h1 className="mt-2 text-3xl font-black">آژانس‌های همکار</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">درخواست ثبت‌نام آژانس را بررسی کنید، نتیجه را اعلام کنید و سقف خرید اعتباری آن را به تومان تعیین کنید. مصرف و رزرو اعتبار به‌صورت خودکار کنترل می‌شود.</p>
      </header>
      <AgencyManager initial={agencies} />
    </section>
  );
}
