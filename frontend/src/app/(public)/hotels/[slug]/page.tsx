import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HotelAmenities } from "@/components/content/hotel-amenities";
import { CountryFlag } from "@/components/content/country-flag";
import { HotelImageGallery } from "@/components/content/hotel-image-gallery";
import { HotelLocationMap } from "@/components/content/hotel-location-map";
import { HotelStars } from "@/components/content/hotel-stars";
import { RichText } from "@/components/content/rich-text";
import { PageIntro } from "@/components/layout/page-intro";
import { Container } from "@/components/ui/container";
import { apiGet } from "@/lib/api/client";
import { findCountryImageId } from "@/lib/country-name";

type Props = {
  params: Promise<{ slug: string }>;
};
type Hotel = {
  avinaProfile?: Record<string, string> | null;
  name: string;
  slug: string;
  starRating: number;
  summary: string;
  description: string;
  locationDescription: string | null;
  roomsDescription: string | null;
  amenitiesDescription: string | null;
  diningDescription: string | null;
  bookingDescription: string | null;
  pricingDescription: string | null;
  policiesDescription: string | null;
  cancellationPolicy: string | null;
  basePrice: string | null;
  currency: string;
  region: string | null;
  address: string | null;
  imageId: number | null;
  imageAltText: string | null;
  galleryImageIds: number[];
  roomTypes: { id: number; name: string; priceAmount: string; currency: string }[];
  destination: { title: string; slug: string; country: string };
};
type Country = { name: string; imageId: number | null };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await apiGet<Hotel>(`/hotels/${slug}`, {
    cache: "no-store",
  }).catch(() => null);
  return {
    title: hotel?.name ?? "هتل",
    description: hotel?.summary,
    alternates: { canonical: `/hotels/${slug}/` },
  };
}

export default async function HotelDetailPage({ params }: Props) {
  const { slug } = await params;
  const [hotel, countryPayload] = await Promise.all([
    apiGet<Hotel>(`/hotels/${slug}`, { cache: "no-store" }).catch(() => null),
    apiGet<{ items: Country[] }>("/countries", { cache: "no-store" }).catch(() => ({ items: [] })),
  ]);
  if (!hotel) notFound();
  const countryFlagImageId = findCountryImageId(countryPayload.items, hotel.destination.country);

  const images = [hotel.imageId, ...hotel.galleryImageIds].filter(
    (id, index, values): id is number =>
      Boolean(id) && values.indexOf(id) === index,
  ).slice(0, 7);
  const sections = [
    ["معرفی هتل", hotel.description],
    ["موقعیت و دسترسی", hotel.locationDescription],
    ["اتاق‌ها و سوئیت‌ها", hotel.roomsDescription],
    ["امکانات و تفریحات", hotel.amenitiesDescription],
    ["رستوران‌ها و پذیرایی", hotel.diningDescription],
    ["رزرو و اقامت", hotel.bookingDescription],
    ["قوانین عمومی هتل", hotel.policiesDescription],
    ["قوانین لغو و استرداد هتل", hotel.cancellationPolicy],
  ] as const;

  return (
    <>
      <PageIntro
        eyebrow={<span className="inline-flex items-center gap-2"><CountryFlag country={hotel.destination.country} imageId={countryFlagImageId} />{hotel.destination.country}<HotelStars rating={hotel.starRating} /></span>}
        title={hotel.name}
        description={hotel.summary}
      />
      <Container className="py-10 sm:py-16">
        {images.length ? (
          <HotelImageGallery hotelName={hotel.name} imageAltText={hotel.imageAltText} imageIds={images} />
        ) : null}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article className="space-y-6">
            {sections.map(([title, content]) => {
              if (!content) return null;
              if (title === "امکانات و تفریحات") {
                return (
                  <HotelAmenities
                    description={content}
                    key={title}
                    region={hotel.region}
                    roomType={hotel.roomTypes[0]?.name ?? "اتاق منتخب"}
                    serviceType="پذیرایی هتل"
                    variant="detail"
                  />
                );
              }
              return <HotelSection content={content} key={title} title={title} />;
            })}
          </article>
          <aside className="h-fit self-start rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-black text-brand">اطلاعات اقامت</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {Object.entries({ englishName: "نام انگلیسی", chainName: "زنجیره هتل", checkInTime: "ساعت ورود", checkOutTime: "ساعت خروج", website: "وب‌سایت هتل" }).map(([key, label]) =>
                hotel.avinaProfile?.[key] ? <div key={key}><dt className="text-muted">{label}</dt><dd className="font-bold">{hotel.avinaProfile[key]}</dd></div> : null)}
              <div>
                <dt className="text-muted">کشور و مقصد</dt>
                <dd className="inline-flex items-center gap-2 font-bold"><CountryFlag country={hotel.destination.country} imageId={countryFlagImageId} />{hotel.destination.country}، {hotel.destination.title}</dd>
              </div>
              {hotel.region ? <div><dt className="text-muted">منطقه</dt><dd className="font-bold">{hotel.region}</dd></div> : null}
              {hotel.address ? <div><dt className="text-muted">نشانی</dt><dd className="font-bold">{hotel.address}</dd></div> : null}
            </dl>
            <Link className="mt-6 block rounded-xl bg-accent px-4 py-3 text-center font-black text-brand" href="/contact/">
              درخواست اطلاعات و رزرو
            </Link>
          </aside>
        </div>
        <div className="mt-8">
          <HotelLocationMap
            address={hotel.address}
            country={hotel.destination.country}
            destination={hotel.destination.title}
            name={hotel.name}
            region={hotel.region}
          />
        </div>
      </Container>
    </>
  );
}

function HotelSection({ title, content }: { title: string; content: string }) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <h2 className="mb-4 text-xl font-black text-brand sm:text-2xl">{title}</h2>
      <RichText content={content} />
    </section>
  );
}
