"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Keep results close to the search controls on phones without losing filters. */
export function ResponsiveFilterPanel({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 801px)");
    const update = () => setOpen(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-base font-black text-brand">{title}</summary>
    {children}
  </details>;
}
