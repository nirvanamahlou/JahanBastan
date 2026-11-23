import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { HotelCard } from "@/components/content/hotel-card";
import { CountryFlag } from "@/components/content/country-flag";
import { RichText } from "@/components/content/rich-text";
import { TourListingCard } from "@/components/content/tour-listing-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { findCountryImageId } from "@/lib/country-name";
import { formatPersianDate } from "@/lib/persian-date";

type Props = { params: Promise<{ slug: string }> };
type Destination = {
  title: string;
  country: string;
  city: string | null;
  summary: string;
  description: string;
  attractions: string | null;
  bestTravelTime: string | null;
  travelTips: string | null;
  imageId: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  galleryImageIds: number[];
};
type RelatedTour = {
  id: number;
  slug: string;
  title: string;
  durationDays: number | null;
  departureDate: string | null;
  priceAmount: string | null;
  currency: string | null;
  transportation: string | null;
  summary: string | null;
  destination: { title: string; country: string } | null;
  imageId: number | null;
  isFeatured: boolean;
};
type RelatedHotel = {
  id: number;
  name: string;
  slug: string;
  starRating: number;
  summary: string;
  region: string | null;
  address: string | null;
  imageId: number | null;
  basePrice: string | null;
  currency: string;
  destination: { title: string; slug: string; country: string };
};
type Country = { name: string; imageId: number | null };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await apiGet<Destination>(`/destinations/${slug}`, {
    cache: "no-store",
  }).catch(() => null);
  return {
    title: item?.metaTitle ?? item?.title ?? "مقصد",
    description: item?.metaDescription ?? item?.summary,
    alternates: { canonical: `/destinations/${slug}/` },
  };
}

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params;
  const destinationQuery = new URLSearchParams({
    destinationSlug: slug,
    pageSize: "3",
  });
  const tourQuery = new URLSearchParams(destinationQuery);
  tourQuery.set("sort", "featured");

  const [item, tourPayload, hotelPayload, countryPayload] = await Promise.all([
    apiGet<Destination>(`/destinations/${slug}`, {
      cache: "no-store",
    }).catch(() => null),
    apiGet<{ items: RelatedTour[] }>(`/tours?${tourQuery}`, {
      cache: "no-store",
    }).catch(() => ({ items: [] })),
    apiGet<{ items: RelatedHotel[] }>(`/hotels?${destinationQuery}`, {
      cache: "no-store",
    }).catch(() => ({ items: [] })),
    apiGet<{ items: Country[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
  ]);
  if (!item) notFound();
  const countryFlagImageId = findCountryImageId(countryPayload.items, item.country);

  return (
    <>
      <section className="relative mx-auto min-h-[30rem] max-w-[96rem] overflow-hidden bg-brand sm:mt-3 sm:rounded-[2rem]">
        {item.imageId ? (
          <Image
            alt={item.title}
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={`${PUBLIC_API_BASE_URL}/media/${item.imageId}`}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-l from-brand/95 via-brand/55 to-brand/10" />
        <Container className="relative flex min-h-[30rem] items-end py-10 text-white sm:py-14">
          <div className="max-w-2xl">
            <Badge className="inline-flex items-center gap-2" variant="accent">
              <CountryFlag country={item.country} imageId={countryFlagImageId} />
              {item.country}
              {item.city ? `، ${item.city}` : ""}
            </Badge>
            <h1 className="mt-5 text-4xl font-black sm:text-6xl">{item.title}</h1>
            <p className="mt-4 max-w-xl leading-8 text-white/80">{item.summary}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={`/tours/?destination=${encodeURIComponent(slug)}`}>
                مشاهده تورهای این مقصد
              </ButtonLink>
              <ButtonLink
                href="/contact/"
                variant="secondary"
                className="border-white/25 bg-white/10 text-white"
              >
                مشاوره سفر
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-10 sm:py-14">
        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5 text-center">
            <p className="text-xs text-muted">کشور</p>
            <p className="mt-2 inline-flex items-center gap-2 text-lg font-black"><CountryFlag className="h-5 w-8" country={item.country} imageId={countryFlagImageId} />{item.country}</p>
          </Card>
          <Card className="border-accent bg-surface-muted p-5 text-center">
            <p className="text-xs text-muted">بهترین زمان سفر</p>
            <p className="mt-2 text-lg font-black">
              {item.bestTravelTime || "تمام سال"}
            </p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-xs text-muted">نوع راهنما</p>
            <p className="mt-2 text-lg font-black">راهنمای کامل مقصد</p>
          </Card>
        </section>

        <div className="mt-8 grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
          <Card as="article">
            <h2 className="text-2xl font-black">معرفی {item.title}</h2>
            <RichText className="mt-4" content={item.description} />
          </Card>
          <div className="grid gap-5">
            <Card>
              <h2 className="text-xl font-black">جاذبه‌ها</h2>
              <RichText
                className="mt-3"
                content={item.attractions || "اطلاعاتی ثبت نشده است."}
              />
            </Card>
            <Card className="border-accent bg-surface-muted">
              <h2 className="text-xl font-black">نکات سفر</h2>
              <RichText
                className="mt-3"
                content={item.travelTips || "اطلاعاتی ثبت نشده است."}
              />
            </Card>
          </div>
        </div>

        <section className="mt-12" aria-labelledby="related-tours-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-accent-strong">تورهای پیشنهادی</p>
              <h2 id="related-tours-title" className="mt-1 text-2xl font-black">
                تورهای مرتبط با {item.title}
              </h2>
            </div>
            <ButtonLink
              href={`/tours/?destination=${encodeURIComponent(slug)}`}
              variant="secondary"
            >
              مشاهده همه تورها
            </ButtonLink>
          </div>
          {tourPayload.items.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {tourPayload.items.map((tour) => (
                <TourListingCard
                  key={tour.id}
                  id={tour.id}
                    slug={tour.slug}
                  title={tour.title}
                  destination={tour.destination?.title || item.title}
                  country={tour.destination?.country || item.country}
                  countryFlagImageId={countryFlagImageId}
                  departureDate={
                    tour.departureDate
                      ? formatPersianDate(tour.departureDate)
                      : null
                  }
                  durationDays={tour.durationDays}
                  transportation={tour.transportation}
                  price={
                    tour.priceAmount
                      ? formatCurrency(tour.priceAmount, tour.currency)
                      : "استعلام قیمت"
                  }
                  summary={tour.summary}
                  featured={tour.isFeatured}
                  imageUrl={
                    tour.imageId
                      ? `${PUBLIC_API_BASE_URL}/media/${tour.imageId}`
                      : null
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="هنوز تور مرتبطی منتشر نشده است"
              description={`تورهای منتشرشده برای ${item.title} به‌صورت خودکار در این بخش نمایش داده می‌شوند.`}
            />
          )}
        </section>

        <section className="mt-12" aria-labelledby="related-hotels-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-accent-strong">اقامت منتخب</p>
              <h2 id="related-hotels-title" className="mt-1 text-2xl font-black">
                هتل‌های {item.title}
              </h2>
            </div>
            <ButtonLink
              href={`/hotels/?country=${encodeURIComponent(item.country)}`}
              variant="secondary"
            >
              مشاهده همه هتل‌ها
            </ButtonLink>
          </div>
          {hotelPayload.items.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {hotelPayload.items.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  slug={hotel.slug}
                  name={hotel.name}
                  destination={hotel.destination.title}
                  country={hotel.destination.country}
                  countryFlagImageId={countryFlagImageId}
                  starRating={hotel.starRating}
                  summary={hotel.summary}
                  region={hotel.region}
                  address={hotel.address}
                  imageUrl={
                    hotel.imageId
                      ? `${PUBLIC_API_BASE_URL}/media/${hotel.imageId}`
                      : null
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="هنوز هتلی برای این مقصد منتشر نشده است"
              description={`هتل‌های منتشرشده برای ${item.title} به‌صورت خودکار در این بخش نمایش داده می‌شوند.`}
            />
          )}
        </section>
        {item.galleryImageIds.length ? (
          <section className="mt-10">
            <div className="mb-5">
              <p className="text-sm font-bold text-brand">گالری مقصد</p>
              <h2 className="mt-1 text-2xl font-black">
                تصاویر الهام‌بخش {item.title}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {item.galleryImageIds.map((id, index) => (
                <div
                  className={`relative overflow-hidden rounded-3xl ${
                    index === 0 ? "aspect-[16/10] sm:col-span-2" : "aspect-[4/3]"
                  }`}
                  key={id}
                >
                  <Image
                    alt={`${item.title}، تصویر ${index + 1}`}
                    className="object-cover transition duration-500 hover:scale-105"
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    src={`${PUBLIC_API_BASE_URL}/media/${id}`}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </>
  );
}
