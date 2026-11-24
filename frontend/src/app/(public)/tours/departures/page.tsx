import Link from "next/link";
import catalogStyles from "@/components/content/catalog-layout.module.css";
import { Container } from "@/components/ui/container";
import { formatPersianDate } from "@/lib/persian-date";
import { getDepartures, hotelImages } from "./catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "تورهای تاریخ‌دار | جهان باستان" };

export default async function DatedToursPage() {
  const tours = await getDepartures();
  return <Container className={`${catalogStyles.catalogContainer} space-y-5 py-8`}>
    <Link href="/tours/">بازگشت به همه تورها</Link>
    <h1 className="text-3xl font-black text-brand">تورهای تاریخ‌دار</h1>
    {!tours.length && <p>در حال حاضر توری برای نمایش موجود نیست.</p>}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{tours.map(tour => {
      const image = tour.hotels.flatMap(hotelImages)[0];
      return <Link key={tour.id} href={`/tours/departures/${tour.id}/`} className={`${catalogStyles.catalogCard} overflow-hidden hover:shadow-md`}>
        {image && <img src={image} alt="" className="aspect-[16/9] w-full object-cover" />}
        <div className="space-y-2 p-4"><p className="text-sm text-muted">{tour.outbound.originName} به {tour.outbound.destinationName}</p>
        <h2 className="text-xl font-black text-brand">{tour.title}</h2>
        <p>{formatPersianDate(tour.startsOn)} تا {formatPersianDate(tour.endsOn)}</p>
        <span className="inline-block rounded-xl bg-brand px-4 py-2 text-white">مشاهده جزئیات تور</span></div>
      </Link>;
    })}</div>
  </Container>;
}
