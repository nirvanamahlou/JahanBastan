import type { Metadata } from "next";

import {
  HotelCatalog,
  type CatalogHotel,
} from "@/components/content/hotel-catalog";
import { PageIntro } from "@/components/layout/page-intro";
import catalogStyles from "@/components/content/catalog-layout.module.css";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { apiGet } from "@/lib/api/client";
import { normalizeCountryName } from "@/lib/country-name";

export const metadata: Metadata = {
  title: "هتل‌ها",
  description:
    "هتل‌های منتشرشده جهان باستان را بر اساس کشور، ستاره و امتیاز مهمان مقایسه کنید.",
  alternates: { canonical: "/hotels/" },
};

type Country = { id: number; name: string; slug: string; imageId: number | null };
type DestinationOption = { id: number; title: string; slug: string; country: string };

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; passengerCount?: string; destinationSlug?: string; page?: string; hotelQuery?: string }>;
}) {
  const { country = "", passengerCount = "", destinationSlug = "", page = "1", hotelQuery = "" } = await searchParams;
  const pageSize = 24;
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const query = new URLSearchParams({ pageSize: String(pageSize), offset: String((currentPage - 1) * pageSize) });
  const hotelSearch = typeof hotelQuery === "string" ? hotelQuery.trim().slice(0, 180) : "";
  if (hotelSearch) query.set("q", hotelSearch);
  if (country) query.set("country", country);
  if (passengerCount) query.set("passengerCount", passengerCount);
  if (destinationSlug) query.set("destinationSlug", destinationSlug);
  const destinationQuery = new URLSearchParams({ pageSize: "100" });


  const [hotelPayload, countryPayload, destinationPayload] = await Promise.all([
    apiGet<{ items: CatalogHotel[]; total: number; limit: number; offset: number }>(`/hotels?${query}`, {
      cache: "no-store",
    }).catch(() => ({ items: [], total: 0, limit: pageSize, offset: 0 })),
    apiGet<{ items: Country[] }>("/countries", { cache: "no-store" }).catch(
      () => ({ items: [] }),
    ),
    apiGet<{ items: DestinationOption[] }>(`/destinations?${destinationQuery}`, { cache: "no-store" }).catch(() => ({ items: [], total: 0, limit: pageSize, offset: 0 })),
  ]);

  return (
    <>
      <PageIntro compact className={catalogStyles.hotelListIntro}
        eyebrow="اقامت در مقصد"
        title="هتل‌ها بر اساس کشور"
      />
      <section className="py-4 sm:py-6">
        <Container className={catalogStyles.catalogContainer}>
          {destinationPayload.items.length ? (
            <HotelCatalog
              countries={countryPayload.items}
              country={country}
              countryFlagImageIds={Object.fromEntries(countryPayload.items.map((item) => [normalizeCountryName(item.name), item.imageId]))}
              destinations={destinationPayload.items}
              hotels={hotelPayload.items}
              passengerCount={passengerCount}
              selectedDestinationSlug={destinationSlug}
            />
          ) : (
            <EmptyState
              description="پس از انتشار هتل از پنل مدیریت، اطلاعات آن به‌صورت خودکار اینجا نمایش داده می‌شود."
              title="هتلی در این کشور منتشر نشده است"
            />
          )}
          <Pagination
            basePath="/hotels/"
            currentPage={currentPage}
            searchParams={{ country, passengerCount, destinationSlug, hotelQuery: hotelSearch }}
            totalPages={Math.ceil(hotelPayload.total / pageSize)}
          />
        </Container>
      </section>
    </>
  );
}
