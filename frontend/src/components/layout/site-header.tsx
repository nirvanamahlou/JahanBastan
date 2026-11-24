"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MouseEvent, Suspense, useCallback, useEffect, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { Dialog } from "@/components/ui/dialog";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { readCustomerSession } from "@/lib/customer-session";

import { BrandLogo } from "./brand-logo";
import styles from "./site-header.module.css";
import { PhoneIcon } from "./site-icons";

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

const headerLinks = [
  ...siteConfig.navigation.flatMap(({ label, href, children }) => [
    { label, href },
    ...(children?.filter((child) => child.href !== href) ?? []),
  ]),
  { label: "نصب وب‌اپ", href: "/install/" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

  function openAccount(event: MouseEvent<HTMLAnchorElement>) {
    if (customerName || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setAccountOpen(true);
  }

  const loadCustomer = useCallback(async () => {
    const response = await readCustomerSession().catch(() => null);
    if (!response?.ok) {
      setCustomerName(null);
      return;
    }
    const payload = await response.json() as { user?: { fullName?: string } };
    setCustomerName(payload.user?.fullName ?? "کاربر");
  }, []);

  useEffect(() => {
    // Every fresh page load starts in light mode. Dark mode remains an explicit,
    // session-only choice and never inherits a stale mobile/browser preference.
    localStorage.removeItem("jahan-bastan-theme");
    document.documentElement.dataset.theme = "day";
  }, []);

  useEffect(() => {
    const refreshAccountState = () => {
      void loadCustomer();
    };
    const timer = window.setTimeout(refreshAccountState, 0);
    window.addEventListener("customer-authenticated", refreshAccountState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("customer-authenticated", refreshAccountState);
    };
  }, [loadCustomer]);

  useEffect(() => {
    const updateHeader = () => setIsScrolled(window.scrollY > 12);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  return (
    <header className={`site-header ${pathname === "/" ? styles.home : ""} relative z-50 w-full border-b border-white/45 bg-white/72 text-brand shadow-[0_10px_30px_rgba(1,37,105,0.12)] backdrop-blur-2xl transition-[background-color,box-shadow,border-color] duration-300 ${isScrolled ? "border-brand/15 shadow-[0_14px_34px_rgba(1,37,105,0.18)]" : ""}`}>
      <Container className={styles.bar}>
        <Link href="/" aria-label={siteConfig.name} className={styles.logoMark}>
          <BrandLogo decorative priority />
        </Link>
        <nav aria-label="منوی اصلی" className={styles.compactMenu}>
          <ul>
            {headerLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={isCurrentRoute(pathname, item.href) ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.actions}>
          <a
            href={`tel:${siteConfig.phoneHref}`}
            aria-label={`تماس با شماره ${siteConfig.phoneDisplay}`}
            className="phone-chip-motion inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/70 bg-white/52 px-3 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_7px_18px_rgba(1,37,105,0.08)] backdrop-blur-md"
            dir="rtl"
          >
            <PhoneIcon className="size-4 text-brand" />
            <strong className="whitespace-nowrap text-xs text-brand" dir="ltr">{siteConfig.phoneDisplay}</strong>
          </a>

          <Link
            href="/account/"
            onClick={openAccount}
            aria-haspopup={customerName ? undefined : "dialog"}
            className="inline-flex min-h-10 items-center whitespace-nowrap rounded-xl border account-primary border-[#102747] px-5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_9px_20px_rgba(16,39,71,0.18)] transition hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-[#25466e]"
          >
            {customerName ? "پنل کاربری" : "ورود / ثبت‌نام"}
          </Link>
        </div>
      </Container>
      <Dialog open={accountOpen} title="ورود و ثبت‌نام" compact onClose={() => setAccountOpen(false)}>
        {accountOpen && <Suspense fallback={null}><AccountForm compact onAuthenticated={() => setAccountOpen(false)} /></Suspense>}
      </Dialog>
    </header>
  );
}
