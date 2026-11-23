import {
  HotelManager,
  type ManagedHotel,
} from "@/components/admin/hotel-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";
import type { DestinationOption } from "@/types/editorial";

export default async function AdminHotelsPage() {
  const { cookieHeader } = await requireAdmin();
  const headers = { cookie: cookieHeader };
  const [hotelsResponse, destinationsResponse] = await Promise.all([
    adminFetch("/admin/hotels?limit=500", { headers, cache: "no-store" }),
    adminFetch("/admin/destinations?limit=500", {
      headers,
      cache: "no-store",
    }),
  ]);
  if (!hotelsResponse.ok || !destinationsResponse.ok) {
    const failedResponse = hotelsResponse.ok
      ? destinationsResponse
      : hotelsResponse;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert" aria-live="assertive" aria-atomic="true">
        <h1 className="text-xl font-black text-red-900">Could not load hotel management</h1>
        <p className="mt-2 text-sm text-red-800">
          The admin API returned status {failedResponse.status}. Please retry after checking the backend.
        </p>
      </div>
    );
  }
  const hotels = (await hotelsResponse.json()) as ManagedHotel[];
  const destinations =
    (await destinationsResponse.json()) as DestinationOption[];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-brand">اقامت</p>
        <h1 className="mt-2 text-3xl font-black">مدیریت هتل‌ها</h1>
        <p className="mt-2 text-muted">
          هتل‌ها را ثبت کنید، برایشان گالری بسازید و سپس به تور وصل کنید.
        </p>
      </header>
      <HotelManager
        destinations={destinations}
        initialItems={hotels}
      />
    </div>
  );
}
