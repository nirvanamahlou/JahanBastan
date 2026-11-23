"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

import { analyticsPageUrl, analyticsReferrer, GA_MEASUREMENT_ID } from "@/lib/analytics";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  "ga-disable-G-6GYSK29XHN"?: boolean;
};

export function GoogleAnalytics() {
  const pathname = usePathname();
  const lastPage = useRef<string | null>(null);

  useEffect(() => {
    const target = window as AnalyticsWindow;
    const page = process.env.NODE_ENV === "production"
      ? analyticsPageUrl(window.location.href)
      : null;
    target[`ga-disable-${GA_MEASUREMENT_ID}`] = !page;
    if (!page) {
      lastPage.current = null;
      return;
    }

    if (!target.gtag) {
      target.dataLayer = target.dataLayer || [];
      target.gtag = function () {
        // gtag's command queue uses Arguments objects, as in Google's snippet.
        // eslint-disable-next-line prefer-rest-params
        target.dataLayer!.push(arguments);
      };
      target.gtag("js", new Date());
      target.gtag("config", GA_MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: page,
        page_referrer: analyticsReferrer(document.referrer),
      });
    }
    if (lastPage.current === page) return;
    target.gtag("set", {
      page_location: page,
      page_referrer: lastPage.current || analyticsReferrer(document.referrer),
    });
    target.gtag("event", "page_view", {
      send_to: GA_MEASUREMENT_ID,
      page_location: page,
      page_title: document.title,
    });
    lastPage.current = page;
  }, [pathname]);

  // No tag is loaded on an initial visit to an account, payment or admin page.
  if (process.env.NODE_ENV !== "production" || !pathname || !analyticsPageUrl(`https://jahanbastan.ir${pathname}`)) return null;

  return <Script id="jahan-bastan-google-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />;
}
