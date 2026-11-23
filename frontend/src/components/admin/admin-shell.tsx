"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import {
  BookIcon,
  ChatIcon,
  ClipboardIcon,
  CloseIcon,
  ClockIcon,
  CreditCardIcon,
  DatabaseIcon,
  GridIcon,
  HelpCircleIcon,
  HotelIcon,
  LocationIcon,
  MenuIcon,
  PlaneIcon,
  SettingsIcon,
  SuitcaseIcon,
  TagIcon,
  UsersIcon,
} from "@/components/layout/site-icons";
import { BrandLogo } from "@/components/layout/brand-logo";
import { BackNavigation } from "@/components/layout/back-navigation";

import { LogoutButton } from "./logout-button";
import { AdminContentSearch } from "./admin-content-search";

const navigation = [
  { label: "سبد، مدارک و پرداخت‌ها", href: "/admin/checkout/", icon: CreditCardIcon },
  { label: "سبدهای خرید", href: "/admin/carts/", icon: CreditCardIcon },
  { label: "گفتگوهای پشتیبانی", href: "/admin/support/", icon: ChatIcon },
  { label: "درخواست‌های رزرو", href: "/admin/bookings/", icon: ClipboardIcon },
  { label: "پرونده مشتریان", href: "/admin/customers/", icon: UsersIcon },
  { label: "آژانس‌ها و اعتبار", href: "/admin/agencies/", icon: CreditCardIcon },
  { label: "امنیت و سوابق", href: "/admin/audit/", icon: ClockIcon },
  { label: "داشبورد", href: "/admin/", icon: GridIcon },
  { label: "مرکز عملیات", href: "/admin/operations/", icon: ClipboardIcon },
  { label: "تورها", href: "/admin/tours/", icon: PlaneIcon },
  { label: "هتل‌ها", href: "/admin/hotels/", icon: HotelIcon },
  { label: "بلیت‌ها و خدمات سفر", href: "/admin/services/", icon: SuitcaseIcon },
  { label: "مقاصد", href: "/admin/destinations/", icon: LocationIcon },
  { label: "راهنمای سفر", href: "/admin/articles/", icon: BookIcon },
  { label: "داده‌ها", href: "/admin/data-transfer/", icon: DatabaseIcon },
  { label: "سوالات متداول", href: "/admin/faq/", icon: HelpCircleIcon },
  { label: "مدیریت نرخ‌ها", href: "/admin/pricing/", icon: TagIcon },
  { label: "خرید اقساطی", href: "/admin/installments/", icon: CreditCardIcon },
  { label: "مدیریت لودینگ", href: "/admin/loading/", icon: ClockIcon },
  { label: "تنظیمات سایت", href: "/admin/settings/", icon: SettingsIcon },
  { label: "امنیت حساب", href: "/admin/security/", icon: ClockIcon },
] as const;
const navigationGroups = [
  { label: "فروش و مشتریان", items: navigation.slice(0, 8) },
  { label: "محتوای سفر", items: navigation.slice(8, 16) },
  { label: "تنظیمات و ابزارها", items: navigation.slice(16) },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function saveActiveContent(event: KeyboardEvent) {
      const isSaveKey = event.code === "KeyS" || event.key.toLowerCase() === "s";
      if (!isSaveKey || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.defaultPrevented || event.isComposing) return;

      const target = event.target instanceof Element ? event.target : document.activeElement;
      const scope = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') ?? document.getElementById("admin-main");
      if (!scope) return;
      const forms = Array.from(scope.querySelectorAll<HTMLFormElement>("form[data-admin-save-form]"))
        .filter(form => form.getClientRects().length > 0);
      const focused = target?.closest("form");
      const form = focused ? forms.find(candidate => candidate === focused) : forms.length === 1 ? forms[0] : undefined;
      if (!form) return;

      event.preventDefault();
      const save = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (!event.repeat && save && !save.matches(":disabled")) form.requestSubmit(save);
    }

    document.addEventListener("keydown", saveActiveContent);
    return () => document.removeEventListener("keydown", saveActiveContent);
  }, []);

  if (pathname === "/admin/login" || pathname === "/admin/login/") {
    return <main className="grid min-h-screen place-items-center bg-surface-muted p-4 sm:p-8">{children}</main>;
  }

  return (
    <div className="admin-shell min-h-screen bg-surface-muted lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className={`fixed inset-y-0 right-0 z-50 flex min-h-0 w-72 flex-col bg-brand p-5 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto ${open ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-5">
          <Link href="/admin/" className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white p-1.5">
              <BrandLogo decorative className="h-full w-full object-contain" />
            </span>
            <span><strong className="block">مدیریت جهان باستان</strong><small className="text-white/60">پنل محتوا</small></span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center lg:hidden" aria-label="بستن منوی مدیریت"><CloseIcon className="size-6" /></button>
        </div>
        <nav aria-label="منوی مدیریت" className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pe-1">
          <ul className="grid gap-2 pb-3">
            {navigationGroups.map((group) => (
              <li className="pt-3 first:pt-0" key={group.label}>
                <p className="mb-2 px-3 text-[10px] font-black tracking-[.12em] text-white/45">{group.label}</p>
                <ul className="grid gap-1.5">
                  {group.items.map(({ icon: Icon, ...item }) => {
                    const active = item.href === "/admin/" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-accent text-brand shadow-[0_8px_18px_rgba(0,0,0,.16)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                          <Icon className="size-4.5" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}          </ul>
        </nav>
        <div className="shrink-0 border-t border-white/15 pt-5"><LogoutButton /></div>
      </aside>
      {open ? <button type="button" aria-label="بستن منوی مدیریت" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-brand/35 lg:hidden" /> : null}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-border bg-surface/90 px-3 shadow-[0_8px_24px_rgba(1,37,105,.08)] backdrop-blur-xl sm:px-8">
          <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-xl border border-border lg:hidden" aria-label="بازکردن منوی مدیریت"><MenuIcon className="size-6" /></button>
          <p className="hidden font-black min-[430px]:block">پنل مدیریت محتوا</p>
          <Link href="/" target="_blank" className="whitespace-nowrap text-xs font-bold text-brand sm:text-sm">مشاهده سایت</Link>
        </header>
        <main className="admin-workspace p-3 sm:p-8" id="admin-main" tabIndex={-1}>
          <BackNavigation variant="admin" />
          <div className="mb-5"><AdminContentSearch key={pathname} /></div>
          {children}
        </main>
      </div>
    </div>
  );
}
