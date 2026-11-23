import { DestinationManager } from "@/components/admin/destination-manager";
import { CountryManager } from "@/components/admin/country-manager";
import { ADMIN_API_BASE_URL, requireAdmin } from "@/lib/admin";
import type { ManagedCountry, ManagedDestination } from "@/types/destination";

export default async function AdminDestinationsPage() {
  const { cookieHeader } = await requireAdmin();
  const [response, countriesResponse] = await Promise.all([
    fetch(`${ADMIN_API_BASE_URL}/admin/destinations`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
    fetch(`${ADMIN_API_BASE_URL}/admin/countries`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
  ]);
  const items = response.ok
    ? (await response.json()) as ManagedDestination[]
    : [];
  const countries = countriesResponse.ok
    ? (await countriesResponse.json()) as ManagedCountry[]
    : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-brand">مدیریت محتوا</p>
        <h1 className="mt-2 text-3xl font-black">مقاصد گردشگری</h1>
        <p className="mt-2 text-muted">
          عنوان، شهر، معرفی، تصویر، جاذبه‌ها، بهترین زمان سفر و SEO.
        </p>
      </header>
      <CountryManager initialCountries={countries} />
      <DestinationManager countries={countries} initialDestinations={items} />
    </div>
  );
}
