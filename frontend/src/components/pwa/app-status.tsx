"use client";

import { useEffect, useState } from "react";

export function AppStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const refresh = () => setOffline(!navigator.onLine);
    const frame = requestAnimationFrame(refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);
  if (offline) return <p role="status" className="border-b border-border bg-white px-4 py-3 text-center text-sm leading-7 text-brand">اتصال اینترنت قطع است. برای بررسی قیمت و ظرفیت تازه و ادامه رزرو، دوباره متصل شوید.</p>;
  return null;
}
