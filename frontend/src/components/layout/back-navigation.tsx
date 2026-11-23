"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ArrowLeftIcon } from "@/components/layout/site-icons";

type BackNavigationProps = {
  variant?: "public" | "admin";
};

const MAX_HISTORY_LENGTH = 30;

function isSafeInternalPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function readHistory(key: string) {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(stored) ? stored.filter(isSafeInternalPath).slice(-MAX_HISTORY_LENGTH) : [];
  } catch {
    return [];
  }
}

function writeHistory(key: string, history: string[]) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(history.slice(-MAX_HISTORY_LENGTH)));
  } catch {
    // Navigation still works through the route fallback when storage is unavailable.
  }
}

function currentRelativeUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function fallbackPath(pathname: string) {
  if (pathname === "/admin" || pathname === "/admin/") return "/";
  if (pathname.startsWith("/admin/")) return "/admin/";

  if (/^\/hotels\/[^/]+\/?$/.test(pathname)) {
    const tourSlug = new URLSearchParams(window.location.search).get("tour");
    if (tourSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(tourSlug)) {
      return `/tours/${tourSlug}/#tour-booking`;
    }
    return "/hotels/";
  }

  const detailParents = ["tours", "hotels", "destinations", "articles", "services", "account"];
  const [firstSegment, secondSegment] = pathname.split("/").filter(Boolean);
  if (firstSegment && secondSegment && detailParents.includes(firstSegment)) {
    return `/${firstSegment}/`;
  }

  return "/";
}

export function BackNavigation({ variant = "public" }: BackNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const historyKey = `jahan-bastan-navigation-history:${variant}`;

  useEffect(() => {
    const current = currentRelativeUrl();
    const history = readHistory(historyKey);
    const existingIndex = history.lastIndexOf(current);
    const nextHistory = existingIndex >= 0
      ? history.slice(0, existingIndex + 1)
      : [...history, current];
    writeHistory(historyKey, nextHistory);
  }, [historyKey, pathname]);

  if (variant === "public" && pathname === "/") return null;

  const goBack = () => {
    const current = currentRelativeUrl();
    const history = readHistory(historyKey);
    const currentIndex = history.lastIndexOf(current);
    const previous = currentIndex > 0 ? history[currentIndex - 1] : null;

    if (previous && isSafeInternalPath(previous)) {
      writeHistory(historyKey, history.slice(0, currentIndex));
      router.push(previous);
      return;
    }

    router.push(fallbackPath(pathname));
  };

  const button = (
    <button
      aria-label="بازگشت به صفحه قبل"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand/20 bg-white px-4 py-2 text-sm font-black text-brand shadow-sm transition hover:border-brand hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
      onClick={goBack}
      type="button"
    >
      <ArrowLeftIcon className="size-4 rotate-180" />
      بازگشت
    </button>
  );

  if (variant === "admin") {
    return <nav aria-label="مسیر بازگشت" className="mb-3">{button}</nav>;
  }

  return <nav aria-label="مسیر بازگشت" className="site-container py-3">{button}</nav>;
}
