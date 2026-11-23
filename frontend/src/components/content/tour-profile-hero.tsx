import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import tourStyles from "./structured-tour-content.module.css";

type Props = { title:string; summary?:ReactNode; image?:ReactNode; destination?:ReactNode; badges?:ReactNode; rating?:ReactNode; actions?:ReactNode };
export function TourProfileHero({title,summary,image,destination,badges,rating,actions}:Props) {
  return (
      <section className={`relative min-h-[31rem] overflow-hidden bg-brand sm:mt-3 sm:rounded-[2rem] ${tourStyles.profileFrame} ${tourStyles.heroShell}`} data-scroll-reveal-skip>
        {image}
        <div className="absolute inset-0 bg-gradient-to-l from-brand/95 via-brand/65 to-brand/20" />
        <div aria-hidden="true" className={tourStyles.heroAura} />
        <Container className="relative flex min-h-[31rem] flex-col justify-between py-7 text-white">
          <nav aria-label="مسیر صفحه" className="text-sm text-white/75">
            <Link href="/">خانه</Link>
            <span aria-hidden="true"> ← </span>
            <Link href="/tours/">تورها</Link>
            {destination}
          </nav>
          <div className="grid items-end gap-8 pb-4 lg:grid-cols-[1fr_auto]">
            <div className="max-w-3xl">
              {badges}
              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-6xl">{title}</h1>
              <p className="mt-4 max-w-2xl leading-8 text-white/85">
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
