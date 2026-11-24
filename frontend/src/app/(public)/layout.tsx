import { AppAccessGate } from "@/components/layout/app-access-gate";
import { Suspense } from "react";
import { cookies } from "next/headers";
import "../web-cards.css";
import "../app-shell.css";

import { ComparisonProvider } from "@/components/content/comparison-provider";
import { PageComments } from "@/components/content/page-comments";
import { AutumnDecor } from "@/components/layout/autumn-decor";
import { BackNavigation } from "@/components/layout/back-navigation";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { PublicPageSkeleton } from "@/components/layout/public-page-skeleton";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AppStatus } from "@/components/pwa/app-status";
import { OnlineSalesProvider } from "@/components/online-sales-provider";
import { ScrollRevealController } from "@/components/layout/scroll-reveal-controller";
import { getPublicSettings } from "@/lib/api/public-settings";

type Settings = { socialLinks: Record<string, string> };
export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hasSessionCookie = (await cookies()).has(process.env.CUSTOMER_SESSION_COOKIE_NAME ?? "customer_session");
  return <Suspense fallback={null}><AppAccessGate hasSessionCookie={hasSessionCookie}><Suspense fallback={<PublicPageSkeleton />}>
    <PublicLayoutContent>{children}</PublicLayoutContent>
  </Suspense></AppAccessGate></Suspense>;
}

async function PublicLayoutContent({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getPublicSettings().catch((): Settings => ({ socialLinks: {} }));
  const links: Record<string, string> = settings.socialLinks;
  const autumnThemeEnabled = links.autumnThemeEnabled === "true";
  const onlineSalesEnabled = links.onlineSalesEnabled === "true";
  return (
    <OnlineSalesProvider enabled={onlineSalesEnabled}>
    <ComparisonProvider>
    <div
      className="public-shell relative flex min-h-screen flex-col overflow-clip"
      data-season={autumnThemeEnabled ? "autumn" : undefined}
    >
      {autumnThemeEnabled ? <AutumnDecor /> : null}
      <a href="#main-content" className="fixed start-4 top-3 z-[100] -translate-y-24 rounded-lg bg-foreground px-4 py-2 text-background focus:translate-y-0">پرش به محتوای اصلی</a>
      <SiteHeader />
      <AppStatus />
      <ScrollRevealController />
      <main id="main-content" className="flex-1 outline-none" tabIndex={-1}>
        <Suspense fallback={null}><BackNavigation /></Suspense>
        {children}
        <Suspense fallback={null}><PageComments /></Suspense>
      </main>
      <Suspense fallback={null}><SiteFooter /></Suspense>
      <MobileBottomNav />
    </div>
    </ComparisonProvider>
    </OnlineSalesProvider>
  );
}
