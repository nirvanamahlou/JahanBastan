import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";

import { SupportChatWidget } from "@/components/support-chat-widget";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SITE_URL } from "@/lib/site-url";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { NoraPresence } from "@/components/nora-presence";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#012569",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "جهان باستان",
  appleWebApp: { capable: true, title: "جهان باستان", statusBarStyle: "default" },
  title: {
    default: "جهان باستان | تور و خدمات سفر",
    template: "%s | جهان باستان",
  },
  description:
    "پکیج‌های تور، مقصدهای گردشگری و خدمات سفر جهان باستان",
  icons: {
    icon: [
      {
        url: "/images/brand/jahan-bastan-logo.png",
        type: "image/png",
      },
    ],
    apple: "/pwa/apple-touch-icon.png",
  },
  openGraph: {
    locale: "fa_IR",
    siteName: "جهان باستان",
    type: "website",
    images: [
      {
        url: "/images/brand/jahan-bastan-logo.png",
        width: 1024,
        height: 1024,
        alt: "نشان جهان باستان",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fa" dir="rtl" data-theme="day" className="h-full scroll-smooth" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "production" && (
          <script id="yektanet-analytics" nonce={nonce} dangerouslySetInnerHTML={{ __html: `
            !function (t, e, n) {
                if (!/^(www\\.)?jahanbastan\\.ir$/.test(t.location.hostname) || /^\\/admin(\\/|$)/.test(t.location.pathname) || /^\\/account\\/.+/.test(t.location.pathname)) return;
                if (e.getElementById("ua-script-ZvOviJeW")) return;
                t.yektanetAnalyticsObject = n, t[n] = t[n] || function () {
                    t[n].q.push(arguments)
                }, t[n].q = t[n].q || [];
                var a = new Date, r = a.getFullYear().toString() + "0" + a.getMonth() + "0" + a.getDate() + "0" + a.getHours(),
                    c = e.getElementsByTagName("script")[0], s = e.createElement("script");
                s.id = "ua-script-ZvOviJeW"; s.dataset.analyticsobject = n;
                s.async = 1; s.type = "text/javascript";
                s.src = "https://cdn.yektanet.com/rg_woebegone/scripts_v3/ZvOviJeW/rg.complete.js?v=" + r, c.parentNode.insertBefore(s, c)
            }(window, document, "yektanet");
          ` }} />
        )}
      </head>
      <body className="flex min-h-full flex-col antialiased"><PwaProvider>{children}</PwaProvider><SupportChatWidget /><Suspense fallback={null}><GoogleAnalytics /><NoraPresence /></Suspense></body>
    </html>
  );
}
