import { ServiceManager } from "@/components/admin/catalog-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";
import type { ManagedTravelService } from "@/types/editorial";

export default async function AdminServicesPage() {
  const { cookieHeader } = await requireAdmin();
  const headers = { cookie: cookieHeader };
  const [servicesResponse, countriesResponse] = await Promise.all([
    adminFetch("/admin/services?limit=500", { headers, cache: "no-store" }),
    adminFetch("/admin/countries", { headers, cache: "no-store" }),
  ]);
  if (!servicesResponse.ok || !countriesResponse.ok) {
    const failedResponse = servicesResponse.ok
      ? countriesResponse
      : servicesResponse;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
        <h1 className="text-xl font-black text-red-900">Could not load service management</h1>
        <p className="mt-2 text-sm text-red-800">
          The admin API returned status {failedResponse.status}. Please retry after checking the backend.
        </p>
      </div>
    );
  }
  const items =
    (await servicesResponse.json()) as ManagedTravelService[];
  const countries =
    (await countriesResponse.json()) as Array<{ id: number; name: string }>;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-brand">مدیریت محتوا</p>
        <h1 className="mt-2 text-3xl font-black">بلیت هواپیما، قطار و خدمات سفر</h1>
        <p className="mt-2 text-muted">بلیت‌های یک‌طرفه هواپیما و قطار و سایر خدمات سفر را ایجاد، جست‌وجو و ویرایش کنید.</p>
      </header>
      <ServiceManager
        countries={countries}
        initialItems={items}
      />
    </div>
  );
}
