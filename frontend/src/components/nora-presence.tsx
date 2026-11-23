"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Only an anonymous session ID, navigation ID and allowlisted category leave the browser. */
export function NoraPresence() {
  const path = usePathname();
  const params = useSearchParams();
  const serviceType = path === "/services" || path === "/services/" ? params.get("type") : null;
  useEffect(() => {
    if (/^\/(admin|account|checkout|api)(\/|$)/.test(path)) return;
    const categories: [string, string][] = [["/services/hotels", "hotels"], ["/services/flights", "flights"], ["/services/trains", "trains"], ["/services/buses", "buses"], ["/services/visas", "visas"], ["/destinations", "destinations"], ["/tours", "tours"], ["/hotels", "hotels"], ["/articles", "articles"], ["/services", "services"]];
    const visa = serviceType === "visa" || document.querySelector('[data-nora-category="visas"]') !== null;
    const category = visa ? "visas" : path === "/" ? "home" : categories.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"))?.[1] ?? "other";
    const random = () => crypto.randomUUID().replaceAll("-", "");
    let browserId = random();
    try {
      const stored = JSON.parse(localStorage.getItem("nora-anonymous-presence") ?? "null") as {id: string; until: number} | null;
      if (stored && stored.until > Date.now() && /^[a-f0-9]{32}$/.test(stored.id)) browserId = stored.id;
      else localStorage.setItem("nora-anonymous-presence", JSON.stringify({id: browserId, until: Date.now() + 86400000}));
    } catch { /* Tracking still works without persistent browser storage. */ }
    const eventId = random();
    const send = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/activity/nora-presence", {method: "POST", credentials: "omit", headers: {"Content-Type": "application/json"}, body: JSON.stringify({browserId, eventId, category}), signal: AbortSignal.timeout(5000)}).catch(() => {});
    };
    send(); const timer = setInterval(send, 25000);
    document.addEventListener("visibilitychange", send);
    return () => {clearInterval(timer); document.removeEventListener("visibilitychange", send);};
  }, [path, serviceType]);
  return null;
}
