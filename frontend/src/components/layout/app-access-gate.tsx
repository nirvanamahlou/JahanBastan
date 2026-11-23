"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { invalidateCustomerSession, readCustomerSession } from "@/lib/customer-session";
import { appReturnPath, isAppEntryExempt } from "@/lib/app-entry";
import styles from "./app-access-gate.module.css";

// This controls app onboarding. Private data remains authorized by the API.
export function AppAccessGate({ children, login = false, hasSessionCookie = true }: { children?: ReactNode; login?: boolean; hasSessionCookie?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [result, setResult] = useState({ path: pathname, status: login ? "guest" : "checking" });
  const [attempt, setAttempt] = useState(0);
  const verified = useRef(false);
  const next = appReturnPath(params.get("next"));

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    let controller: AbortController;
    let disposed = false;
    async function check() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const isApp = media.matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (!login && (!isApp || isAppEntryExempt(pathname))) {
        setResult({ path: pathname, status: "ready" });
        return;
      }
      // No cookie can only prove absence, never authentication. Render the
      // sign-in form immediately; real sessions are still checked by the API.
      if (!hasSessionCookie) {
        if (!login) window.location.replace(`/login/?next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`);
        return;
      }
      // Keep an already verified app usable during background revalidation.
      if (!login && !verified.current) setResult({ path: pathname, status: "checking" });
      try {
        const response = await readCustomerSession();
        if (disposed || signal.aborted) return;
        if (response.ok) {
          verified.current = true;
          if (login) window.location.replace(next);
          else setResult({ path: pathname, status: "ready" });
        } else if (response.status === 401 || response.status === 403) {
          verified.current = false;
          if (login) setResult({ path: pathname, status: "guest" });
          else window.location.replace(`/login/?next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`);
        } else setResult({ path: pathname, status: "error" });
      } catch {
        if (!disposed && !signal.aborted) setResult({ path: pathname, status: "error" });
      }
    }
    const refresh = () => { invalidateCustomerSession(); void check(); };
    const onLogout = () => {
      verified.current = false;
      setResult({ path: pathname, status: "checking" });
      refresh();
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    void check();
    media.addEventListener("change", check);
    window.addEventListener("customer-logged-out", onLogout);
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      media.removeEventListener("change", check);
      window.removeEventListener("customer-logged-out", onLogout);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, login, next, attempt, hasSessionCookie]);

  const status = result.status;
  const message = <div className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-8" dir="rtl">
    {login && status === "guest" ? <div className="w-full max-w-xl">
      <p className="mb-5 text-center text-sm text-brand">برای ورود به اپ جهان باستان، وارد شوید یا حساب بسازید.</p>
      <AccountForm refreshAfterAuthentication={false} onAuthenticated={() => window.location.replace(next)} />
    </div> : <div className="space-y-4 text-center" role="status">
      <p>{status === "error" ? "بررسی حساب انجام نشد. اتصال اینترنت را بررسی کنید." : "در حال بررسی حساب کاربری…"}</p>
      {status === "error" && <button className="rounded-xl bg-brand px-6 py-3 text-white" onClick={() => setAttempt(value => value + 1)}>تلاش دوباره</button>}
    </div>}
  </div>;
  if (login) return message;
  return <>
    <div className={status === "ready" ? styles.ready : status === "checking" ? styles.pending : styles.hidden}>{children}</div>
    {status !== "ready" && <div className={status === "checking" ? styles.pendingMessage : undefined}>{message}</div>}
  </>;
}
