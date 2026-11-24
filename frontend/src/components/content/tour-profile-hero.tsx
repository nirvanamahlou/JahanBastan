import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import tourStyles from "./structured-tour-content.module.css";

type Props = { title:string; summary?:ReactNode; image?:ReactNode; destination?:ReactNode; badges?:ReactNode; rating?:ReactNode; actions?:ReactNode };
export function TourProfileHero({title,summary,image,destination,badges,rating,actions}:Props) {
  return (
      <section className={`relative overflow-hidden bg-brand sm:mt-3 sm:rounded-[2rem] ${tourStyles.profileFrame} ${tourStyles.heroShell}`} data-scroll-reveal-skip>
        {image}
        <div className="absolute inset-0 bg-gradient-to-l from-brand/95 via-brand/65 to-brand/20" />
        <div aria-hidden="true" className={tourStyles.heroAura} />
        <Container className="relative flex min-h-64 flex-col justify-between gap-5 pt-4 pb-6 text-white sm:min-h-80 sm:pt-5 lg:min-h-[20rem]">
          <nav aria-label="مسیر صفحه" className="text-sm text-white/75">
            <Link href="/">خانه</Link>
            <span aria-hidden="true"> ← </span>
            <Link href="/tours/">تورها</Link>
            {destination}
          </nav>
          <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-5">
            <div className="max-w-3xl">
              {badges}
              <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl lg:text-5xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
                {summary}
              </p>
              {rating}
            </div>
            {actions}
          </div>
        </Container>
      </section>
  );
}
