"use client";

import Image from "next/image";
import Link from "next/link";
import { type MouseEvent, useState } from "react";

type DestinationRailItem = {
  id: number;
  title: string;
  slug: string;
  country: string;
  bestTravelTime: string | null;
  imageUrl: string | null;
};

function visibleOffsets(itemCount: number) {
  if (itemCount <= 1) return [0];
  if (itemCount === 2) return [-1, 0];
  if (itemCount === 3) return [-1, 0, 1];
  if (itemCount === 4) return [-2, -1, 0, 1];
  return [-2, -1, 0, 1, 2];
}

export function DestinationRail({
  destinations,
}: {
  destinations: DestinationRailItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(2, Math.max(0, destinations.length - 1)),
  );

  function selectDestination(direction: "next" | "previous") {
    setActiveIndex((current) => {
      if (direction === "next") return (current + 1) % destinations.length;
      return (current - 1 + destinations.length) % destinations.length;
    });
  }

  const visibleDestinations = visibleOffsets(destinations.length).map((offset) => {
    const index = (activeIndex + offset + destinations.length) % destinations.length;
    return { destination: destinations[index], offset };
  });

  function handleCardClick(
    event: MouseEvent<HTMLAnchorElement>,
    offset: number,
  ) {
    if (offset === 0) return;
    event.preventDefault();
    setActiveIndex((current) => (current + offset + destinations.length) % destinations.length);
  }

  return (
    <section
      className="relative mx-auto w-full max-w-5xl px-2 pb-2 pt-1 sm:px-10 sm:pb-3"
      aria-labelledby="popular-destinations-title"
      aria-roledescription="carousel"
    >
      <div className="mb-4 text-center">
        <h2
          id="popular-destinations-title"
          className="text-lg font-black text-brand sm:text-xl"
        >
          مقاصد محبوب
        </h2>
        <span className="mt-0.5 block text-sm leading-none text-brand" aria-hidden="true">
          ✦
        </span>
      </div>

      <div className="relative flex min-h-64 items-center justify-center sm:min-h-56">
        <button
          type="button"
          onClick={() => selectDestination("previous")}
          className="absolute right-0 z-20 grid size-9 place-items-center rounded-full bg-brand text-xl text-white shadow-md transition hover:scale-105 hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-brand sm:right-1"
          aria-label="نمایش مقصد قبلی"
        >
          <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
            <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
          </svg>
        </button>

        <div className="flex w-full items-center justify-center gap-2 overflow-hidden px-11 sm:gap-3 lg:gap-4">
          {visibleDestinations.map(({ destination, offset }) => {
            const active = offset === 0;
            const outer = Math.abs(offset) === 2;

            return (
              <Link
                key={`${destination.id}-${offset}`}
                href={`/destinations/${destination.slug}/`}
                onClick={(event) => handleCardClick(event, offset)}
                aria-current={active ? "true" : undefined}
                aria-label={
                  active
                    ? `مشاهده مقصد ${destination.title}`
                    : `انتخاب ${destination.title} در مرکز`
                }
                className={`group relative shrink-0 overflow-hidden rounded-[1.6rem] border border-white/60 bg-white/15 text-white ring-1 ring-brand/10 backdrop-blur-md transition-[width,height,opacity,transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-accent/90 hover:shadow-[0_22px_48px_rgba(1,37,105,0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${
                  active
                    ? "z-10 h-64 w-full max-w-64 shadow-[0_16px_34px_rgba(1,37,105,0.25)] sm:h-52 sm:w-44"
                    : outer
                      ? "hidden h-40 w-28 opacity-80 lg:block"
                      : "hidden h-44 w-32 opacity-90 sm:block"
                }`}
              >
                {destination.imageUrl ? (
                  <Image
                    alt=""
                    className="object-cover transition duration-700 ease-out group-hover:scale-110"
                    fill
                    sizes={
                      active
                        ? "(max-width: 640px) 256px, 176px"
                        : "(max-width: 1024px) 128px, 112px"
                    }
                    src={destination.imageUrl}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-brand/95 via-brand/15 to-transparent" />
                <div className={`absolute inset-x-0 bottom-0 ${active ? "p-4" : "p-3"}`}>
                  <p className={`${active ? "text-lg" : "text-sm"} font-black drop-shadow-[0_2px_8px_rgba(1,37,105,.85)]`}>
                    {destination.title}
                  </p>
                  <p className="mt-1.5 inline-flex rounded-full border border-white/35 bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">{destination.country}</p>
                  {active ? (
                    <p className="mt-2 line-clamp-2 text-[11px] font-bold text-white">
                      بهترین زمان سفر: {destination.bestTravelTime ?? "تمام سال"}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => selectDestination("next")}
          className="absolute left-0 z-20 grid size-9 place-items-center rounded-full bg-brand text-xl text-white shadow-md transition hover:scale-105 hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-brand sm:left-1"
          aria-label="نمایش مقصد بعدی"
        >
          <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
          </svg>
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted sm:hidden">
        برای تغییر مقصد از فلش‌ها استفاده کنید.
      </p>
      <Link
        href="/destinations/"
        className="mx-auto mt-4 flex min-h-9 w-fit items-center justify-center rounded-xl border border-brand/20 px-4 text-xs font-bold text-brand transition hover:bg-brand-soft"
      >
        مشاهده همه مقصدها
      </Link>
    </section>
  );
}
