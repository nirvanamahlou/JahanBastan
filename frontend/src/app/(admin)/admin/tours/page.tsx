import { type AvinaTourEditorial } from "@/components/admin/avina-tour-manager";
import { loadAdminOptions } from "@/lib/api/load-admin-options";
import { TourManager } from "@/components/admin/catalog-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";
import type { DestinationOption, HotelOption, ManagedTour, ManagedTravelService } from "@/types/editorial";

export default async function AdminToursPage() {
  const { cookieHeader } = await requireAdmin();
  const [response, hotels, destinationsResponse, avinaResponse, servicesResponse] = await Promise.all([
    adminFetch("/admin/tours", { headers: { cookie: cookieHeader }, cache: "no-store" }),
    loadAdminOptions<HotelOption>((offset, limit) => adminFetch(`/admin/hotels?offset=${offset}&limit=${limit}`, { headers: { cookie: cookieHeader }, cache: "no-store" })),
    adminFetch("/admin/destinations", { headers: { cookie: cookieHeader }, cache: "no-store" }),
    adminFetch("/admin/avina-tours", { headers: { cookie: cookieHeader }, cache: "no-store" }),
    adminFetch("/admin/services", { headers: { cookie: cookieHeader }, cache: "no-store" }),
  ]);
  const items = response.ok ? (await response.json()) as ManagedTour[] : [];

  const destinations = destinationsResponse.ok ? (await destinationsResponse.json()) as DestinationOption[] : [];
  const transportServices = servicesResponse.ok
    ? ((await servicesResponse.json()) as ManagedTravelService[]).filter((service) =>
        ["flight", "train", "bus"].includes(service.serviceType),
      )
    : [];
  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-brand">مدیریت فروش</p>
        <h1 className="mt-2 text-3xl font-black">مدیریت تورها</h1>
        <p className="mt-2 text-muted">تور جدید بسازید، مشخصات و هتل آن را ویرایش کنید و نحوه نمایش در سایت را کنترل کنید.</p>
      </header>
      <TourManager
        initialItems={items}
        initialAvinaTours={avinaResponse.ok ? await avinaResponse.json() as AvinaTourEditorial[] : []}
        avinaLoadFailed={!avinaResponse.ok}
        hotels={hotels}
        destinations={destinations}
        transportServices={transportServices}
        initialLoadError={response.ok ? undefined : `دریافت فهرست تورها ناموفق بود (کد ${response.status}).`}
      />
    </div>
  );
}
