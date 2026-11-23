import Link from "next/link";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type DestinationCardProps = {
  name: string;
  country: string;
  bestSeason: string;
  tourCount: number;
  href: string;
  tone?: "navy" | "pink";
  imageUrl?: string | null;
};

export function DestinationCard({
  name,
  country,
  bestSeason,
  tourCount,
  href,
  tone = "navy",
  imageUrl,
}: DestinationCardProps) {
  const cover =
    tone === "pink"
      ? "bg-[radial-gradient(circle_at_75%_20%,#ffffff_0,transparent_25%),linear-gradient(145deg,#D8EAFF_0%,#4E83C4_100%)] text-brand"
      : "bg-[radial-gradient(circle_at_75%_20%,#D8EAFF_0,transparent_28%),linear-gradient(145deg,#012569_0%,#174891_100%)] text-white";

  return (
    <Card
      as="article"
      data-scroll-reveal
      className="group relative min-h-[18rem] overflow-hidden p-0 text-white transition duration-300 hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-[0_24px_60px_rgba(1,37,105,0.18)]"
    >
      <div className={`absolute inset-0 overflow-hidden p-6 ${cover}`}>
        {imageUrl ? <Image alt={name} className="object-cover" fill sizes="(max-width:640px) 100vw, 25vw" src={imageUrl} /> : null}
        {imageUrl ? <div className="absolute inset-0 bg-gradient-to-t from-brand/95 via-brand/10 to-brand/15" /> : null}
        <div className="absolute -bottom-10 -left-8 size-36 rounded-full border-[18px] border-current opacity-10 transition duration-300 group-hover:scale-110" />
        <Badge variant={tone === "pink" ? "brand" : "accent"}>{country}</Badge>
        <p className="relative mt-16 text-3xl font-black">{name}</p>
      </div>

      <div className="relative z-10 mt-auto flex flex-col justify-end p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-3 text-xs text-white">
          <div>
            <dt className="text-white/60">بهترین زمان سفر</dt>
            <dd className="mt-1 font-bold">{bestSeason}</dd>
          </div>
          <div>
            <dt className="text-white/60">تورهای فعال</dt>
            <dd className="mt-1 font-bold">{tourCount.toLocaleString("fa-IR")} تور</dd>
          </div>
        </dl>
        <Link
          href={href}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white hover:text-brand focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`مشاهده راهنمای سفر و تورهای ${name}`}
        >
          کشف مقصد
        </Link>
      </div>
    </Card>
  );
}
