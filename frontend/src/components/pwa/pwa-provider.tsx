"use client";

import { sendYektanetEvent, YEKTANET_INSTALL_TAG } from "@/lib/yektanet-events";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaState = {
  installed: boolean;
  canInstall: boolean;
  installing: boolean;
  message: string;
  waiting: ServiceWorker | null;
  install: () => Promise<void>;
  update: () => void;
};
const PwaContext = createContext<PwaState | null>(null);
export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("PwaProvider is required");
  return value;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const approvedUpdate = useRef(false);
  const installReported = useRef(false);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const refresh = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const frame = requestAnimationFrame(refresh);
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const finish = () => {
      setInstalled(true); setPrompt(null); setMessage("");
      if (!installReported.current) {
        installReported.current = true;
        sendYektanetEvent(YEKTANET_INSTALL_TAG);
      }
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", finish);
    display.addEventListener("change", refresh);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", finish);
      display.removeEventListener("change", refresh);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext || !("serviceWorker" in navigator)) return;
    let stopped = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | null = null;
    const inspect = () => {
      if (!stopped && registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
    };
    const trackInstall = () => {
      installingWorker?.removeEventListener("statechange", inspect);
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener("statechange", inspect);
    };
    let lastCheck = 0;
    const check = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      void registration?.update().catch(() => {});
      inspect();
    };
    const controllerChanged = () => {
      if (approvedUpdate.current) {
        approvedUpdate.current = false;
        // A worker update needs a fresh document, not client-side navigation.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((reg) => {
      if (stopped) return;
      registration = reg;
      inspect();
      trackInstall();
      reg.addEventListener("updatefound", trackInstall);
      check();
    }).catch(() => { /* Website and manual install instructions remain usable. */ });
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      stopped = true;
      registration?.removeEventListener("updatefound", trackInstall);
      installingWorker?.removeEventListener("statechange", inspect);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
    };
  }, []);

  async function install() {
    if (!prompt || installing) return;
    setInstalling(true);
    setMessage("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "درخواست نصب به مرورگر ارسال شد." : "نصب انجام نشد؛ هر زمان بخواهید از منوی مرورگر اقدام کنید.");
    } catch { setMessage("نصب در این مرورگر انجام نشد. از راهنمای زیر استفاده کنید."); }
    finally { setPrompt(null); setInstalling(false); }
  }
  function update() {
    if (!waiting || !navigator.onLine) return;
    approvedUpdate.current = true;
    waiting.postMessage({ type: "ACTIVATE_UPDATE" });
  }
  return <PwaContext.Provider value={{ installed, canInstall: Boolean(prompt), installing, message, waiting, install, update }}>{children}</PwaContext.Provider>;
}
