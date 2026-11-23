"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, SearchIcon, SuitcaseIcon, UsersIcon } from "./site-icons";

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
}

const items = [
  { href: "/", label: "خانه", Icon: HomeIcon },
  { href: "/destinations/", label: "کشف مقصد", Icon: CompassIcon },
  { href: "/#trip-search", label: "جستجو", Icon: SearchIcon },
  { href: "/tours/", label: "تورها", Icon: SuitcaseIcon },
  { href: "/account/", label: "حساب من", Icon: UsersIcon },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="app-bottom-nav" aria-label="ناوبری پایین اپ">
      {items.map(({ href, label, Icon }) => {
        const search = href.includes("#");
        const active = !search && (href === "/" ? pathname === "/" : `${pathname.replace(/\/$/, "")}/`.startsWith(href));
        return <Link key={href} href={href} prefetch={false} aria-current={active ? "page" : undefined} className={search ? "app-bottom-nav__search" : undefined}>
          <span className="app-bottom-nav__icon"><Icon className="size-6" /></span>
          <span>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
