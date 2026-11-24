"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { readCustomerSession } from "@/lib/customer-session";

import { BrandLogo } from "./brand-logo";
import styles from "./site-header.module.css";
import { ChevronDownIcon, CloseIcon, MenuIcon, MoonIcon, PhoneIcon, SunIcon } from "./site-icons";

// Keep theme behavior available while its public controls are disabled.
const SHOW_THEME_CONTROLS = false;

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

  const loadCustomer = useCallback(async () => {
    const response = await readCustomerSession().catch(() => null);
    if (!response?.ok) {
      setCustomerName(null);
      return;
    }
    const payload = await response.json() as { user?: { fullName?: string } };
    setCustomerName(payload.user?.fullName ?? "کاربر");
  }, []);

  const toggleTheme = () => {
    const nextTheme = isNight ? "day" : "night";
    document.documentElement.dataset.theme = nextTheme;
    setIsNight(nextTheme === "night");
  };

  useEffect(() => {
    // Every fresh page load starts in light mode. Dark mode remains an explicit,
    // session-only choice and never inherits a stale mobile/browser preference.
    localStorage.removeItem("jahan-bastan-theme");
    document.documentElement.dataset.theme = "day";
    const frame = window.requestAnimationFrame(() => setIsNight(false));
    return () => {
      window.cancelAnimationFrame(frame);
    };
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

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={`site-header ${pathname === "/" ? styles.home : ""} relative z-50 w-full border-b border-white/45 bg-white/72 text-brand shadow-[0_10px_30px_rgba(1,37,105,0.12)] backdrop-blur-2xl transition-[background-color,box-shadow,border-color] duration-300 ${isScrolled ? "border-brand/15 shadow-[0_14px_34px_rgba(1,37,105,0.18)]" : ""}`}>
      <div className="hidden">
        <Container className="flex min-h-9 items-center justify-between gap-5 text-xs">
          <p>مجری مستقیم تورهای منتخب و خدمات کامل سفر</p>
          <div className="flex items-center gap-5 text-white/80">
            <Link href="/faq/" className="hover:text-white">سوالات متداول</Link>
            <a href={`tel:${siteConfig.phoneHref}`} dir="ltr" className="font-bold text-white">
              {siteConfig.phoneDisplay}
            </a>
          </div>
        </Container>
      </div>
      <Container className="relative flex min-h-16 items-center justify-between gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-5 lg:min-h-20 xl:[--container-max:96rem]">
        <Link
          href="/"
          aria-label="صفحه اصلی جهان باستان"
          className="group flex shrink-0 items-center gap-3 rounded-xl"
        >
          <BrandLogo
            decorative
            priority
            className="h-14 w-14 object-contain transition-transform group-hover:-translate-y-0.5 lg:h-16 lg:w-16"
          />
          <span className="sr-only">{siteConfig.name} — {siteConfig.description}</span>
          <span className="app-brand-copy" aria-hidden="true"><strong>جهان باستان</strong><small>همراه سفرهای تو</small></span>
        </Link>

        <nav aria-label="منوی اصلی" className="hidden min-w-0 justify-self-center lg:block">
          <ul className="flex flex-nowrap items-center justify-center gap-0.5 overflow-visible whitespace-nowrap rounded-2xl bg-white/35 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_20px_rgba(1,37,105,0.06)] backdrop-blur-md">
            {siteConfig.navigation.map((item) => {
              const active = isCurrentRoute(pathname, item.href);

              return (
                <li key={item.href} className="group/nav relative shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-bold transition-all duration-200 xl:px-3 2xl:px-4 ${
                      active
                        ? "relative bg-brand text-white shadow-[0_6px_14px_rgba(1,37,105,0.18)] ring-1 ring-white/25 after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-white/90"
                        : "text-brand hover:bg-accent/35 hover:text-brand hover:shadow-[0_4px_12px_rgba(185,32,104,0.12)]"
                    }`}
                  >
                    {item.label}
                    {item.children ? <ChevronDownIcon className="size-4" /> : null}
                  </Link>

                  {item.children ? (
                    <div className="invisible absolute start-0 top-full w-60 translate-y-2 pt-3 opacity-0 transition-all group-hover/nav:visible group-hover/nav:translate-y-0 group-hover/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:translate-y-0 group-focus-within/nav:opacity-100">
                      <ul className="rounded-2xl border border-border bg-surface p-2 shadow-[0_20px_45px_rgba(1,37,105,0.14)]">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={"block whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors " + (child.href === "/installments/" ? "bg-accent-strong text-white shadow-[0_6px_16px_rgba(235,93,159,0.25)] hover:bg-[#d94687]" : "text-muted hover:bg-surface-muted hover:text-brand")}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {SHOW_THEME_CONTROLS ? <li className="shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isNight ? "تغییر به حالت روز" : "تغییر به حالت شب"}
                aria-pressed={isNight}
                title={isNight ? "فعال‌کردن حالت روشن" : "فعال‌کردن حالت تاریک"}
                className={"theme-toggle grid size-10 shrink-0 place-items-center rounded-xl border border-brand/20 bg-white/70 text-brand transition-all duration-200 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 " + (isNight ? "relative bg-brand text-white shadow-[0_6px_14px_rgba(1,37,105,0.18)] ring-1 ring-white/25 after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-white/90" : "")}
              >
                {isNight ? <SunIcon className="size-5 text-[#ffd166]" strokeWidth={2.4} /> : <MoonIcon className="size-5" strokeWidth={2.4} />}
                <span className="sr-only">{isNight ? "حالت روشن" : "حالت تاریک"}</span>
              </button>
            </li> : null}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center justify-self-end gap-2">

          <a
            href={`tel:${siteConfig.phoneHref}`}
            aria-label={`تماس با شماره ${siteConfig.phoneDisplay}`}
            className="phone-chip-motion hidden min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/70 bg-white/52 px-3 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_7px_18px_rgba(1,37,105,0.08)] backdrop-blur-md lg:inline-flex"
            dir="rtl"
          >
            <PhoneIcon className="size-4 text-brand" />
            <strong className="whitespace-nowrap text-xs text-brand" dir="ltr">{siteConfig.phoneDisplay}</strong>
          </a>

          <Link
            href="/account/"
            className="hidden min-h-10 items-center whitespace-nowrap rounded-xl border border-[var(--interaction-hover-strong)] bg-[var(--interaction-hover)] px-5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_9px_20px_rgba(199,33,105,0.3)] transition hover:-translate-y-0.5 hover:bg-[var(--interaction-hover-strong)] focus-visible:ring-4 focus-visible:ring-[var(--interaction-hover)] lg:inline-flex"
          >
            {customerName ? "پنل کاربری" : "ورود / ثبت‌نام"}
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? "بستن منو" : "بازکردن منو"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-xl border border-white/70 bg-white/55 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_7px_18px_rgba(1,37,105,0.08)] backdrop-blur-md transition-colors hover:bg-white lg:hidden"
          >
            {menuOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
          </button>
        </div>
      </Container>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="بستن منوی موبایل"
            className="fixed inset-0 top-16 z-40 cursor-default bg-brand/20 backdrop-blur-sm sm:top-20 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-navigation"
            aria-label="منوی موبایل"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overscroll-contain overflow-y-auto border-t border-border bg-surface p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-5rem)] sm:p-4 lg:hidden"
          >
            <Container className="px-0">
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <li className="rounded-xl border border-border bg-background p-1.5"><Link href="/install/" onClick={() => setMenuOpen(false)} className="block min-h-11 rounded-xl px-3 py-2.5 font-bold text-brand">نصب وب‌اپ جهان باستان</Link></li>
                {siteConfig.navigation.map((item) => {
                  const active = isCurrentRoute(pathname, item.href);

                  return (
                    <li
                      key={item.href}
                      className="rounded-xl border border-border bg-background p-1.5 sm:rounded-2xl sm:p-2"
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-xl px-3 py-2.5 font-bold ${
                          active ? "bg-brand text-white shadow-sm ring-1 ring-brand/20" : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                      {item.children ? (
                        <ul className="mt-1 border-r border-border pr-3 text-sm text-muted">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={() => setMenuOpen(false)}
                                className={"block rounded-lg px-3 py-2 transition-colors " + (child.href === "/installments/" ? "bg-accent-strong font-bold text-white hover:bg-[#d94687]" : "hover:bg-surface-muted hover:text-brand")}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 grid grid-cols-1 gap-2 rounded-2xl bg-surface-muted p-3 md:grid-cols-2 md:gap-3 md:p-4">
                {SHOW_THEME_CONTROLS ? <><div className="flex items-center justify-between gap-3 px-1 pb-1 md:col-span-2">
                  <strong className="text-sm text-brand">تنظیمات نمایش</strong>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">حالت فعلی: {isNight ? "تاریک" : "روشن"}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={isNight ? "تغییر به حالت روز" : "تغییر به حالت شب"}
                  aria-pressed={isNight}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 font-bold text-brand"
                >
                  {isNight ? <SunIcon className="size-5 text-[#ffd166]" /> : <MoonIcon className="size-5" />}
                  فعال‌کردن حالت {isNight ? "روشن" : "تاریک"}
                </button>
                </> : null}
                <a
                  href={`tel:${siteConfig.phoneHref}`}
                  className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-brand bg-surface px-4 font-bold text-brand"
                  dir="rtl"
                >
                  <PhoneIcon className="size-4" />
                  <span className="whitespace-nowrap" dir="ltr">{siteConfig.phoneDisplay}</span>
                </a>

                <Link
                  href="/account/"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--interaction-hover-strong)] bg-[var(--interaction-hover)] px-4 font-bold text-white shadow-sm transition hover:bg-[var(--interaction-hover-strong)] focus-visible:ring-4 focus-visible:ring-[var(--interaction-hover)]"
                >
                  {customerName ? "پنل کاربری" : "ورود / ثبت‌نام"}
                </Link>
              </div>
            </Container>
          </nav>
        </>
      ) : null}
    </header>
  );
}
