import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowLeftIcon } from "./site-icons";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
  large?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "مشاهده همه",
  icon,
  large = false,
}: SectionHeadingProps) {
  return (
    <div data-scroll-reveal className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-xl">
        {eyebrow ? <p className="mb-1.5 text-xs font-bold text-brand">{eyebrow}</p> : null}
        <div className="flex items-center gap-2.5">
          {icon ? <span className="grid size-8 place-items-center rounded-lg bg-accent text-brand">{icon}</span> : null}
          <h2
  className={
    large
      ? "text-2xl font-black sm:text-3xl"
      : "text-lg font-black sm:text-xl"
  }
>
  {title}
</h2>
        </div>
        {description ? <p className="mt-1.5 text-xs leading-5 text-muted sm:text-[13px]">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-bold text-brand hover:bg-brand-soft">
          {linkLabel}
          <ArrowLeftIcon className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}
