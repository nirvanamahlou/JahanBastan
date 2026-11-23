import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppAccessGate } from "@/components/layout/app-access-gate";

export const metadata: Metadata = { title: "ورود به اپ", robots: { index: false, follow: false } };

export default async function LoginPage() {
  const hasSessionCookie = (await cookies()).has(process.env.CUSTOMER_SESSION_COOKIE_NAME ?? "customer_session");
  return <main><Suspense fallback={<p className="p-8 text-center" role="status">در حال آماده‌سازی ورود…</p>}><AppAccessGate login hasSessionCookie={hasSessionCookie} /></Suspense></main>;
}
