import { CheckoutManagement } from "@/components/admin/checkout-management";
import { adminFetch, requireAdmin } from "@/lib/admin";

export default async function AdminCheckoutPage() {
  const { cookieHeader } = await requireAdmin();
  const headers = { cookie: cookieHeader };
  const [requirementsResponse, documentsResponse] = await Promise.all([
    adminFetch("/admin/checkout/document-requirements", { headers, cache: "no-store" }),
    adminFetch("/admin/checkout/documents", { headers, cache: "no-store" }),
  ]);
  const requirements = requirementsResponse.ok ? await requirementsResponse.json() : [];
  const documents = documentsResponse.ok ? await documentsResponse.json() : [];
  return (
    <section className="space-y-6" dir="rtl">
      <header>
        <p className="text-sm font-bold text-accent-strong">عملیات فروش و تسویه</p>
        <h1 className="mt-2 text-3xl font-black text-brand">مدیریت سبد، مدارک و پرداخت‌ها</h1>
        <p className="mt-2 max-w-3xl leading-7 text-muted">
          مدارک لازم برای هر نوع سفر را تعریف کنید و فایل‌های بارگذاری‌شده مسافران را
          بررسی، تأیید یا برای اصلاح بازگردانید.
        </p>
      </header>
      <CheckoutManagement
        initialDocuments={documents}
        initialRequirements={requirements}
      />
    </section>
  );
}
